import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import StatCard from '../../components/StatCard';
import { SkeletonGrid } from '../../components/SkeletonCard';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { HiOutlineClipboardCheck, HiOutlineDocumentText, HiOutlineCalendar, HiOutlineChartBar } from 'react-icons/hi';

export default function StudentDashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/student/dashboard');
            setData(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    if (loading) return (
        <DashboardLayout>
            <div style={{ marginBottom: 24 }}><SkeletonGrid count={4} /></div>
            <div style={{ marginBottom: 24 }}><SkeletonGrid count={2} cols="repeat(auto-fill, minmax(280px,1fr))" /></div>
        </DashboardLayout>
    );

    const att = data?.overall_attendance || {};
    const pct = Number(att.percentage) || 0;
    const pctDisplay = Number.isInteger(pct) ? pct : pct.toFixed(1);
    const attColor = pct >= 75 ? '#16A34A' : pct >= 65 ? '#F59E0B' : '#DC2626';

    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (pct / 100) * circumference;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    return (
        <DashboardLayout>
            <div className="page-header-row">
                <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                        {greeting} 👋
                    </p>
                    <h1 style={{ margin: 0 }}>{user?.full_name || 'Student'}</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, textTransform: 'capitalize' }}>
                        Student - {user?.department_name || 'Academic overview'}
                    </p>
                </div>
            </div>

            {/* Complaint window banner */}
            {data?.complaint_window && (
                <div style={{
                    borderRadius: 14, padding: '14px 18px', marginBottom: 24,
                    display: 'flex', alignItems: 'center', gap: 12,
                    background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.2)',
                }}>
                    <span style={{ fontSize: '1.5rem' }}>📢</span>
                    <div>
                        <p style={{ fontWeight: 600, fontSize: '0.835rem', color: '#B8860B' }}>Complaint Portal is OPEN</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Closes on {new Date(data.complaint_window.close_date).toLocaleDateString()}
                        </p>
                    </div>
                </div>
            )}

            {/* Stats row — 4 col desktop, 2 col mobile */}
            <div className="student-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
                <StatCard icon={HiOutlineChartBar} label="Current SGPA" value={data?.gpa?.current_sgpa || '—'} color="#6A1B9A" />
                <StatCard icon={HiOutlineChartBar} label="CGPA" value={data?.gpa?.cgpa || '—'} color="#1565C0" />
                <StatCard icon={HiOutlineDocumentText} label="Pending Leaves"
                    value={data?.leaves?.filter(l => l.status === 'pending').length || 0} color="#E8A020" />
                <StatCard icon={HiOutlineCalendar} label="Upcoming Events" value={data?.upcoming_events?.length || 0} color="#2E7D32" />
            </div>

            {/* Attendance Section — side by side on desktop, stacked on mobile */}
            <div className="student-att-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 28 }}>
                {/* Attendance Gauge */}
                <div style={{
                    borderRadius: 16, padding: '28px 20px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 20 }}>Overall Attendance</p>
                    <div style={{ position: 'relative', width: 150, height: 150 }}>
                        <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
                            <circle cx="75" cy="75" r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
                            <circle cx="75" cy="75" r={radius} fill="none" stroke={attColor} strokeWidth="10"
                                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round" style={{ transition: 'all 1s ease' }} />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '2rem', fontWeight: 800, color: attColor, lineHeight: 1 }}>{pctDisplay}%</span>
                            <span style={{ fontSize: '0.75rem', marginTop: 4, color: 'var(--text-tertiary)' }}>{att.attended || 0}/{att.total || 0}</span>
                        </div>
                    </div>

                    {/* New Attendance Projection Stats */}
                    {data?.attendance_projection && (
                        <div style={{ width: '100%', marginTop: 24 }}>
                            {/* Breakdown */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 4px', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Total</p>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>{data.attendance_projection.total_classes}</p>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 4px', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Attended</p>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16A34A', marginTop: 2 }}>{att.attended || 0}</p>
                                </div>
                                <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 4px', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Missed</p>
                                    <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#DC2626', marginTop: 2 }}>{data.attendance_projection.missed_classes}</p>
                                </div>
                            </div>

                            {/* Highlight Box */}
                            {(() => {
                                const proj = data.attendance_projection;
                                const isBelow = pct < 75;
                                const isZero = proj.remaining_classes <= 0 && !isBelow;
                                const colorState = isBelow || isZero ? 'red' : proj.remaining_classes <= 5 ? 'yellow' : 'green';

                                const styles = {
                                    green: { bg: '#DCFCE7', border: '#86EFAC', text: '#166534' },
                                    yellow: { bg: '#FEF9C3', border: '#FDE047', text: '#854D0E' },
                                    red: { bg: '#FEE2E2', border: '#FCA5A5', text: '#991B1B' }
                                };
                                const currStyle = styles[colorState];

                                return (
                                    <div style={{
                                        background: currStyle.bg, border: `1px solid ${currStyle.border}`, color: currStyle.text,
                                        padding: '12px 16px', borderRadius: 10, textAlign: 'center',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.4 }}>
                                            {isBelow
                                                ? "Attendance below required threshold"
                                                : isZero
                                                    ? "You cannot miss any more classes"
                                                    : `You can miss ${proj.remaining_classes} more classes to stay above 75%`}
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>

                {/* Subject-wise attendance */}
                <div style={{
                    borderRadius: 16, padding: '20px 24px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 16 }}>Subject-wise Attendance</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(data?.subject_attendance || []).length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: 20 }}>No subjects found</p>
                        ) : (data?.subject_attendance || []).map((s, i) => {
                            const c = s.percentage >= 75 ? '#16A34A' : s.percentage >= 65 ? '#F59E0B' : '#DC2626';
                            const sp = Number(s.percentage) || 0;
                            const sPct = Number.isInteger(sp) ? sp : sp.toFixed(1);
                            return (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                                    borderRadius: 12, background: 'var(--bg-secondary)',
                                }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 10,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontSize: '0.75rem', fontWeight: 700, background: c, flexShrink: 0,
                                    }}>{sPct}%</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subject_name}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{s.attended}/{s.total} classes</p>
                                    </div>
                                    {/* Progress bar */}
                                    <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--border)', flexShrink: 0 }}>
                                        <div style={{ width: `${sp}%`, height: '100%', borderRadius: 3, background: c, transition: 'width 1s ease' }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Latest marks & Notices — 2 col desktop, 1 col mobile */}
            <div className="student-bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div style={{
                    borderRadius: 16, padding: '20px 24px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 16 }}>Latest Marks Updates</p>
                    {(data?.latest_marks || []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '28px 16px' }}>
                            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--text-tertiary)' }}>
                                <HiOutlineDocumentText size={22} />
                            </div>
                            <p style={{ fontSize: '0.835rem', color: 'var(--text-tertiary)' }}>No marks published yet</p>
                        </div>
                    ) : data.latest_marks.map((m, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject_name}</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{m.exam_type} — {m.exam_label}</p>
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', paddingLeft: 12, color: 'var(--text-primary)' }}>{m.marks_obtained}/{m.max_marks}</span>
                        </div>
                    ))}
                </div>

                <div style={{
                    borderRadius: 16, padding: '20px 24px',
                    background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 16 }}>Notice Board</p>
                    {(data?.notices || []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '28px 16px' }}>
                            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--text-tertiary)' }}>
                                <HiOutlineCalendar size={22} />
                            </div>
                            <p style={{ fontSize: '0.835rem', color: 'var(--text-tertiary)' }}>No notices</p>
                        </div>
                    ) : data.notices.map(n => (
                        <div key={n.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 8 }}>
                                <p style={{ fontSize: '0.85rem', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{n.title}</p>
                                <span style={{ fontSize: '0.7rem', whiteSpace: 'nowrap', color: 'var(--text-tertiary)' }}>{new Date(n.created_at).toLocaleDateString()}</span>
                            </div>
                            <p style={{ fontSize: '0.75rem', marginTop: 4, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.body?.substring(0, 100)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </DashboardLayout>
    );
}
