import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import StatCard from '../../components/StatCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineUserGroup, HiOutlineAcademicCap, HiOutlineOfficeBuilding,
    HiOutlineChartBar, HiOutlinePlus, HiOutlineFlag, HiOutlinePresentationChartBar,
    HiOutlineArrowRight
} from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';

export default function PrincipalDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/principal/dashboard');
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    const stats = data?.stats || {};
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    const quickActions = [
        { label: 'Add Department', icon: HiOutlinePlus, onClick: () => navigate('/principal/departments'), color: '#1A3C6E', bg: 'rgba(26,60,110,0.06)' },
        { label: 'Create HOD', icon: HiOutlineUserGroup, onClick: () => navigate('/principal/hods'), color: '#2E7D32', bg: 'rgba(46,125,50,0.06)' },
        { label: 'Complaints', icon: HiOutlineFlag, onClick: () => navigate('/principal/complaints'), color: '#DC2626', bg: 'rgba(220,38,38,0.06)', badge: stats.unread_complaints },
        { label: 'Create Poll', icon: HiOutlinePresentationChartBar, onClick: () => navigate('/principal/polls'), color: '#E8A020', bg: 'rgba(232,160,32,0.06)' },
    ];

    return (
        <DashboardLayout>
            {/* Greeting header */}
            <div className="page-header-row">
                <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                        {greeting} 👋
                    </p>
                    <h1 style={{ margin: 0 }}>
                        {user?.full_name || 'Principal'}
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        Institution-wide overview and management
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16, marginBottom: 32,
            }}>
                <StatCard icon={HiOutlineAcademicCap} label="Total Students" value={stats.total_students || 0} color="#6A1B9A" />
                <StatCard icon={HiOutlineUserGroup} label="Total Faculty" value={stats.total_faculty || 0} color="#1565C0" />
                <StatCard icon={HiOutlineOfficeBuilding} label="Departments" value={stats.total_departments || 0} color="#1A3C6E" />
                <StatCard icon={HiOutlineChartBar} label="Avg Attendance"
                    value={`${stats.avg_attendance || 0}%`}
                    color={stats.avg_attendance >= 75 ? '#2E7D32' : '#DC2626'} />
            </div>

            {/* Quick Actions */}
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Quick Actions</h2>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12, marginBottom: 32,
            }}>
                {quickActions.map(action => (
                    <button key={action.label} onClick={action.onClick}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '14px 16px', borderRadius: 12,
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-xs)',
                            cursor: 'pointer', textAlign: 'left', position: 'relative',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: action.bg, color: action.color, flexShrink: 0,
                        }}>
                            <action.icon size={18} />
                        </div>
                        <span style={{ fontSize: '0.835rem', fontWeight: 600, color: 'var(--text-primary)' }}>{action.label}</span>
                        {action.badge > 0 && (
                            <span style={{
                                position: 'absolute', top: 8, right: 8,
                                width: 20, height: 20, borderRadius: '50%',
                                background: '#EF4444', color: 'white',
                                fontSize: '0.65rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>{action.badge}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Department Overview */}
            <div className="page-header-row" style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Department Overview</h2>
                <button onClick={() => navigate('/principal/departments')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: '0.8rem', fontWeight: 600, color: '#1A3C6E',
                        background: 'none', border: 'none', cursor: 'pointer',
                        flexShrink: 0,
                    }}>
                    View All <HiOutlineArrowRight size={14} />
                </button>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 16,
            }}>
                {(data?.department_stats || []).map(dept => (
                    <div key={dept.id}
                        onClick={() => navigate(`/principal/reports?dept=${dept.id}`)}
                        style={{
                            borderRadius: 14, overflow: 'hidden',
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-sm)',
                            cursor: 'pointer', transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                        {/* Top gradient */}
                        <div style={{ height: 4, background: 'linear-gradient(90deg, #1A3C6E, #E8A020)' }} />
                        <div style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: '#1A3C6E', color: 'white',
                                    fontWeight: 700, fontSize: '0.7rem',
                                }}>{dept.code}</div>
                                <div>
                                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0 }}>{dept.name}</p>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: 0 }}>{dept.code}</p>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div style={{
                                    textAlign: 'center', padding: '12px 8px',
                                    borderRadius: 10, background: 'var(--bg-secondary)',
                                }}>
                                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1565C0', margin: 0 }}>{dept.faculty_count}</p>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-tertiary)', margin: '2px 0 0 0' }}>Faculty</p>
                                </div>
                                <div style={{
                                    textAlign: 'center', padding: '12px 8px',
                                    borderRadius: 10, background: 'var(--bg-secondary)',
                                }}>
                                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#6A1B9A', margin: 0 }}>{dept.student_count}</p>
                                    <p style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-tertiary)', margin: '2px 0 0 0' }}>Students</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </DashboardLayout>
    );
}
