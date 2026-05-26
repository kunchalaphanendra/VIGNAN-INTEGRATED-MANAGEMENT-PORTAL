import { useState, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { HiOutlineBell, HiOutlineSearch, HiOutlineTrash, HiOutlineCheck, HiOutlineEye } from 'react-icons/hi';

const typeIcons = {
    notice:     '📢',
    leave:      '📋',
    marks:      '📊',
    attendance: '✅',
    poll:       '🗳️',
    calendar:   '📅',
    complaint:  '📝',
    alert:      '⚠️',
    academic:   '📖',
    placement:  '💼'
};

const typeLabels = {
    notice:     'Notice',
    leave:      'Leave Request',
    marks:      'Marks Alert',
    attendance: 'Attendance',
    poll:       'Poll',
    calendar:   'Event',
    complaint:  'Complaint',
    alert:      'System Alert',
    academic:   'Academic',
    placement:  'Placement'
};

export default function Notifications() {
    const { user } = useAuth();
    const {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification
    } = useNotifications();

    const [filterType, setFilterType] = useState('all');
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // Refresh notifications list when criteria changes
    useEffect(() => {
        fetchNotifications({
            type: filterType,
            search: searchQuery,
            unreadOnly: unreadOnly,
            page: currentPage,
            limit: 20
        });
    }, [filterType, unreadOnly, searchQuery, currentPage]);

    const handleMarkRead = (e, id) => {
        e.stopPropagation();
        markAsRead(id);
    };

    const handleDelete = (e, id) => {
        e.stopPropagation();
        deleteNotification(id);
    };

    const handleRowClick = (notif) => {
        if (!notif.is_read) {
            markAsRead(notif.id);
        }
        if (notif.target_url) {
            window.location.href = notif.target_url;
        }
    };

    return (
        <DashboardLayout>
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <HiOutlineBell className="text-indigo-500 animate-pulse" /> Notification Inbox
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Manage your alerts, reminders, and updates. You have {unreadCount} unread notifications.
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-semibold text-sm rounded-xl transition-all shadow-sm border border-indigo-100 dark:border-indigo-900/60 cursor-pointer"
                    >
                        <HiOutlineCheck /> Mark All Read
                    </button>
                )}
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {['all', 'academic', 'leave', 'marks', 'complaint', 'placement'].map((t) => (
                        <button
                            key={t}
                            onClick={() => { setFilterType(t); setCurrentPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                                filterType === t
                                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:text-slate-400'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={unreadOnly}
                            onChange={(e) => { setUnreadOnly(e.target.checked); setCurrentPage(1); }}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500"
                        />
                        Unread Only
                    </label>

                    <div className="relative w-full max-w-[240px]">
                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search inbox..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-100 focus:bg-white dark:bg-slate-800/80 dark:focus:bg-slate-800 rounded-xl border-none outline-none ring-1 ring-slate-200 dark:ring-slate-800 focus:ring-2 focus:ring-indigo-500 dark:text-slate-100 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Notifications Container */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                {loading && notifications.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        Loading notifications...
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <HiOutlineBell size={32} />
                        </div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-base">No notifications found</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[280px] mx-auto">
                            You're all caught up! Check back later for announcements and alerts.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {notifications.map((notif) => (
                            <div
                                key={notif.id}
                                onClick={() => handleRowClick(notif)}
                                className={`p-4 transition-all duration-150 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/30 ${
                                    notif.is_read ? 'opacity-75' : 'bg-indigo-50/15 dark:bg-indigo-950/5'
                                }`}
                            >
                                <div className="flex items-start gap-4 min-w-0">
                                    <div className="text-2xl mt-0.5 select-none flex-shrink-0">
                                        {typeIcons[notif.type] || '🔔'}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
                                                {typeLabels[notif.type] || notif.type}
                                            </span>
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                • {new Date(notif.created_at).toLocaleString('en-IN', {
                                                    dateStyle: 'medium',
                                                    timeStyle: 'short'
                                                })}
                                            </span>
                                            {!notif.is_read && (
                                                <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 animate-pulse" />
                                            )}
                                        </div>
                                        <h4 className={`text-sm ${notif.is_read ? 'font-medium text-slate-700 dark:text-slate-350' : 'font-bold text-slate-850 dark:text-slate-100'}`}>
                                            {notif.title}
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                                            {notif.message}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {!notif.is_read && (
                                        <button
                                            onClick={(e) => handleMarkRead(e, notif.id)}
                                            title="Mark as Read"
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition-all cursor-pointer"
                                        >
                                            <HiOutlineEye size={16} />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => handleDelete(e, notif.id)}
                                        title="Delete Notification"
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 dark:hover:text-rose-450 transition-all cursor-pointer"
                                    >
                                        <HiOutlineTrash size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
