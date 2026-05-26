import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../utils/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const getSocketUrl = () => {
    const origin = window.location.origin;
    if (origin.includes(':5173')) return origin.replace(':5173', ':5000');
    if (origin.includes(':5174')) return origin.replace(':5174', ':5000');
    if (origin.includes(':5175')) return origin.replace(':5175', ':5000');
    return origin;
};

export function NotificationProvider({ children }) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const socketRef = useRef(null);

    // Fetch notifications list
    const fetchNotifications = async (options = {}) => {
        if (!user) return;
        setLoading(true);
        try {
            const { type = 'all', search = '', unreadOnly = false, page = 1, limit = 20 } = options;
            const res = await api.get('/notifications', {
                params: { type, search, unreadOnly, page, limit }
            });
            setNotifications(res.data.notifications);
            setUnreadCount(res.data.unread_count);
            setTotalCount(res.data.total);
            return res.data;
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    // Mark single notification as read
    const markAsRead = async (id) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: 1 } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        try {
            await api.patch('/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
        }
    };

    // Delete a notification
    const deleteNotification = async (id) => {
        try {
            await api.delete(`/notifications/${id}`);
            const deleted = notifications.find(n => n.id === id);
            setNotifications(prev => prev.filter(n => n.id !== id));
            if (deleted && !deleted.is_read) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
            setTotalCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error deleting notification:', err);
        }
    };

    // Connect / Disconnect socket based on auth state
    useEffect(() => {
        if (!user) {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        // Fetch initial list
        fetchNotifications();

        // Establish Socket Connection
        const token = localStorage.getItem('vimp_token');
        const socket = io(getSocketUrl(), {
            auth: { token },
            autoConnect: true,
            reconnection: true
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[Socket] Connected to real-time notification engine');
            socket.emit('join', {
                id: user.id,
                role: user.role,
                department_id: user.department_id
            });
        });

        socket.on('notification_received', (newNotif) => {
            console.log('[Socket] New notification received:', newNotif);
            setNotifications(prev => [newNotif, ...prev]);
            setUnreadCount(prev => prev + 1);
            setTotalCount(prev => prev + 1);

            // Display Toast notification
            setToast(newNotif);

            // Play notification chime
            try {
                const audio = new Audio('/notification.mp3');
                audio.volume = 0.4;
                audio.play().catch(() => {});
            } catch (soundErr) {
                // Audio play blocked or not found, ignore
            }
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user]);

    // Auto-clear toast after 6 seconds
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 6000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                unreadCount,
                totalCount,
                loading,
                toast,
                setToast,
                fetchNotifications,
                markAsRead,
                markAllAsRead,
                deleteNotification
            }}
        >
            {children}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 animate-slide-in max-w-sm w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 flex gap-4 transition-all duration-300 transform hover:scale-[1.02]">
                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold tracking-wider uppercase text-sky-500">
                                {toast.type || 'Notice'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                                Just Now
                            </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {toast.title}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                            {toast.message}
                        </p>
                        {toast.target_url && (
                            <a
                                href={toast.target_url}
                                onClick={() => setToast(null)}
                                className="inline-flex items-center text-xs font-medium text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 mt-2 transition-colors"
                            >
                                View Details &rarr;
                            </a>
                        )}
                    </div>
                    <button
                        onClick={() => setToast(null)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 self-start text-lg font-bold leading-none p-1"
                    >
                        &times;
                    </button>
                </div>
            )}
            <style>{`
                @keyframes slide-in {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .animate-slide-in {
                    animation: slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
            `}</style>
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => useContext(NotificationContext);
