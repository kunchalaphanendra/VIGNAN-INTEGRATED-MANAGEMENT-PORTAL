import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import StatCard from '../../components/StatCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import { HiOutlineClipboardCheck, HiOutlineClock, HiOutlineBookOpen, HiOutlineBell } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';

export default function FacultyDashboard() {
    const [data, setData] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/faculty/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchUnread = async () => {
        try {
            const res = await api.get('/notifications');
            setUnreadCount(res.data.unread_count || 0);
        } catch { }
    };

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>Faculty Dashboard</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>Your classes and activities overview</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 28 }}>
                <StatCard icon={HiOutlineBookOpen} label="Today's Classes" value={data?.today_classes?.length || 0} color="#1565C0" />
                <StatCard icon={HiOutlineClock} label="Pending Leaves" value={data?.pending_leaves || 0} color="#E8A020" />
                <StatCard icon={HiOutlineBell} label="Unread Notices" value={unreadCount} color="#6A1B9A" onClick={() => navigate('/faculty/notices')} />
                <StatCard icon={HiOutlineClipboardCheck} label="Subjects" value={data?.attendance_summary?.length || 0} color="#2E7D32" />
            </div>

            {/* Today's schedule */}
            <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Today's Schedule</h2>
                {(data?.today_classes || []).length === 0 ? (
                    <div style={{
                        borderRadius: 14, padding: '36px 20px', textAlign: 'center',
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                    }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>No classes scheduled today</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                        {data.today_classes.map((cls, i) => (
                            <div key={i} style={{
                                borderRadius: 14, padding: '14px 16px',
                                display: 'flex', alignItems: 'center', gap: 14,
                                background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                            }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 12,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontSize: '0.7rem', fontWeight: 700,
                                    background: 'linear-gradient(135deg, #1565C0, #42A5F5)',
                                }}>
                                    <span>{cls.start_time?.substring(0, 5)}</span>
                                    <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>{cls.end_time?.substring(0, 5)}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.subject_name}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Year {cls.year} - Sec {cls.section} {cls.room ? `• ${cls.room}` : ''}</p>
                                </div>
                                <button onClick={() => navigate(`/faculty/attendance?assignment=${cls.assignment_id || ''}`)}
                                    style={{
                                        fontSize: '0.75rem', padding: '6px 14px', borderRadius: 8,
                                        fontWeight: 600, color: 'white', border: 'none', cursor: 'pointer',
                                        background: 'linear-gradient(135deg, #1565C0, #42A5F5)',
                                    }}>Mark</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* My Subjects */}
            <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>My Subjects</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                    {(data?.attendance_summary || []).map((s, i) => (
                        <div key={i} style={{
                            borderRadius: 14, padding: 16, transition: 'all 0.2s ease',
                            background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', background: 'linear-gradient(135deg, #1565C0, #42A5F5)',
                                }}><HiOutlineBookOpen size={18} /></div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subject_name}</p>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Year {s.year} · Sec {s.section}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Classes taken</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.classes_taken}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Notices */}
            {data?.notices?.length > 0 && (
                <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Recent Notices</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {data.notices.map(n => (
                            <div key={n.id} style={{
                                borderRadius: 14, padding: '14px 18px',
                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{n.title}</p>
                                        <p style={{ fontSize: '0.75rem', marginTop: 4, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.body?.substring(0, 120)}...</p>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', whiteSpace: 'nowrap', paddingTop: 2, color: 'var(--text-tertiary)' }}>
                                        {new Date(n.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
