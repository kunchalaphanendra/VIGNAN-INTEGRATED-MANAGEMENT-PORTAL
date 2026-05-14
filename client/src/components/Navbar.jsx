import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import { HiOutlineBell, HiOutlineSun, HiOutlineMoon, HiOutlineLogout, HiOutlineMenu, HiOutlineChevronRight } from 'react-icons/hi';

const roleColors = {
    principal: '#B71C1C',
    hod: '#2E7D32',
    faculty: '#1565C0',
    student: '#6A1B9A'
};

const roleLabels = {
    principal: 'Principal',
    hod: 'HOD',
    faculty: 'Faculty',
    student: 'Student'
};

// Map notification type → route for each role
const getNotificationLink = (type, role) => {
    const routes = {
        notice:     `/${role}/notices`,
        leave:      role === 'faculty' ? `/${role}/student-leaves`
                  : role === 'hod'     ? `/${role}/faculty-leaves`
                  : role === 'student' ? `/${role}/dashboard`
                  : `/${role}/dashboard`,
        marks:      `/${role}/marks`,
        attendance: `/${role}/attendance`,
        poll:       `/${role}/polls`,
        calendar:   `/${role}/calendar`,
        complaint:  `/${role}/dashboard`,
        alert:      `/${role}/attendance`,
    };
    return routes[type] || `/${role}/dashboard`;
};

const typeIcons = {
    notice:     '📢',
    leave:      '📋',
    marks:      '📊',
    attendance: '✅',
    poll:       '🗳️',
    calendar:   '📅',
    complaint:  '📝',
    alert:      '⚠️',
};

export default function Navbar({ onMenuClick }) {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [notifCount, setNotifCount] = useState(0);
    const [showNotifs, setShowNotifs] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const notifRef = useRef(null);

    useEffect(() => {
        if (user) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 30000);
            return () => clearInterval(interval);
        }
    }, [user]);

    useEffect(() => {
        const handleClick = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/notifications');
            setNotifCount(res.data.unread_count);
            setNotifications(res.data.notifications.slice(0, 10));
        } catch { }
    };

    const markAllRead = async () => {
        try {
            await api.patch('/notifications/read-all');
            setNotifCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch { }
    };

    // Click a notification → mark it read + navigate to the right page
    const handleNotifClick = async (notif) => {
        setShowNotifs(false);
        // Optimistic update
        if (!notif.is_read) {
            setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
            setNotifCount(prev => Math.max(0, prev - 1));
            api.patch(`/notifications/${notif.id}/read`).catch(() => {});
        }
        navigate(getNotificationLink(notif.type, user.role));
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    if (!user) return null;

    const roleColor = roleColors[user.role] || '#1A3C6E';
    const initials = user.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'U';

    const iconBtnStyle = {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 38, height: 38, borderRadius: 10,
        border: 'none', background: 'transparent',
        color: 'var(--text-secondary)', cursor: 'pointer',
        transition: 'all 0.15s ease',
    };

    return (
        <nav style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
            height: 64, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '0 20px',
            background: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            transition: 'background 0.3s ease, border-color 0.3s ease',
        }}>
            {/* Left */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={onMenuClick}
                    style={{ ...iconBtnStyle, color: 'var(--text-primary)' }}>
                    <HiOutlineMenu size={22} />
                </button>
                <Link to={`/${user.role}/dashboard`} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    textDecoration: 'none',
                }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 800, fontSize: 15,
                        background: `linear-gradient(135deg, #1A3C6E, #2A5298)`,
                        boxShadow: '0 2px 8px rgba(26,60,110,0.25)',
                    }}>V</div>
                    <span style={{
                        fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em',
                        color: 'var(--text-primary)',
                    }}>Vignan Portal</span>
                </Link>
            </div>

            {/* Right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {/* Theme */}
                <button onClick={toggleTheme} style={iconBtnStyle}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    title={theme === 'light' ? 'Dark mode' : 'Light mode'}>
                    {theme === 'light' ? <HiOutlineMoon size={18} /> : <HiOutlineSun size={18} />}
                </button>

                {/* Notifications */}
                <div style={{ position: 'relative' }} ref={notifRef}>
                    <button onClick={() => setShowNotifs(!showNotifs)} style={{ ...iconBtnStyle, position: 'relative' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                        <HiOutlineBell size={18} />
                        {notifCount > 0 && (
                            <span style={{
                                position: 'absolute', top: 4, right: 4,
                                width: 16, height: 16, borderRadius: '50%',
                                background: '#EF4444', color: 'white',
                                fontSize: '0.55rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>{notifCount > 9 ? '9+' : notifCount}</span>
                        )}
                    </button>

                    {showNotifs && (
                        <div className="notif-dropdown animate-scale-in" style={{
                            position: 'absolute', right: 0, top: 48,
                            width: 360, borderRadius: 14,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-xl)',
                            overflow: 'hidden',
                        }}>
                            {/* Header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '14px 16px', borderBottom: '1px solid var(--border)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Notifications</span>
                                    {notifCount > 0 && (
                                        <span style={{
                                            background: '#EF4444', color: 'white',
                                            borderRadius: 20, padding: '1px 7px',
                                            fontSize: '0.68rem', fontWeight: 700,
                                        }}>{notifCount} new</span>
                                    )}
                                </div>
                                {notifCount > 0 && (
                                    <button onClick={markAllRead} style={{
                                        fontSize: '0.75rem', fontWeight: 600, color: roleColor,
                                        background: 'none', border: 'none', cursor: 'pointer',
                                    }}>Mark all read</button>
                                )}
                            </div>

                            {/* List */}
                            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                                        <HiOutlineBell size={28} style={{ color: 'var(--text-tertiary)', margin: '0 auto 8px' }} />
                                        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>No new notifications</p>
                                    </div>
                                ) : notifications.map(n => (
                                    <div key={n.id}
                                        onClick={() => handleNotifClick(n)}
                                        style={{
                                            padding: '11px 14px', cursor: 'pointer',
                                            borderBottom: '1px solid var(--border-light)',
                                            background: n.is_read ? 'transparent' : 'var(--sidebar-active-bg)',
                                            transition: 'background 0.15s',
                                            display: 'flex', alignItems: 'flex-start', gap: 10,
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'var(--sidebar-active-bg)'}>
                                        {/* Type emoji icon */}
                                        <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 2 }}>
                                            {typeIcons[n.type] || '🔔'}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <p style={{
                                                    fontWeight: n.is_read ? 500 : 700,
                                                    fontSize: '0.83rem', color: 'var(--text-primary)',
                                                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>{n.title}</p>
                                                {!n.is_read && (
                                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                                                )}
                                            </div>
                                            <p style={{
                                                fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: 2,
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>{n.message?.substring(0, 65)}</p>
                                            <p style={{ fontSize: '0.67rem', color: 'var(--text-tertiary)', marginTop: 3 }}>
                                                {new Date(n.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                                            </p>
                                        </div>
                                        <HiOutlineChevronRight size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 5 }} />
                                    </div>
                                ))}
                            </div>

                            {/* Footer link */}
                            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                                <button onClick={() => { setShowNotifs(false); navigate(`/${user.role}/notices`); }}
                                    style={{ fontSize: '0.78rem', fontWeight: 600, color: roleColor, background: 'none', border: 'none', cursor: 'pointer' }}>
                                    View all notices →
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="hidden md:block" style={{
                    width: 1, height: 28, margin: '0 8px',
                    background: 'var(--border)',
                }} />

                {/* User */}
                <div className="hidden md:flex" style={{ alignItems: 'center', gap: 10, marginLeft: 4 }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 9,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 600, fontSize: '0.75rem',
                        background: roleColor,
                    }}>{initials}</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.835rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                            {user.full_name}
                        </span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: roleColor, lineHeight: 1.3 }}>
                            {roleLabels[user.role]}
                        </span>
                    </div>
                </div>

                {/* Logout */}
                <button onClick={handleLogout} style={{ ...iconBtnStyle, marginLeft: 4 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#EF4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    title="Logout">
                    <HiOutlineLogout size={18} />
                </button>
            </div>
        </nav>
    );
}
