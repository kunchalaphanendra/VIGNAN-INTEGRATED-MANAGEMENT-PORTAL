import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import {
    HiOutlineAcademicCap, HiOutlineUserGroup, HiOutlineClipboardCheck,
    HiOutlineClock, HiOutlineGlobeAlt,
} from 'react-icons/hi';

const COLORS = ['#1565C0','#2E7D32','#B71C1C','#6A1B9A','#E65100','#00838F'];

function StatCard({ label, value, icon: Icon, color = '#1565C0' }) {
    return (
        <div style={{ padding:'16px 20px', borderRadius:14, background:'var(--bg-card)', border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)', display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:42, height:42, borderRadius:12, background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', color, flexShrink:0 }}>
                <Icon size={20} />
            </div>
            <div>
                <p style={{ fontSize:'0.65rem', color:'var(--text-tertiary)', margin:0, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</p>
                <p style={{ fontSize:'1.6rem', fontWeight:800, color, margin:0, lineHeight:1.1 }}>{value ?? '—'}</p>
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const map = {
        locked:  { label:'✅ Locked',  bg:'rgba(22,163,74,0.1)',   color:'#16A34A', border:'rgba(22,163,74,0.3)' },
        pending: { label:'🔴 Pending', bg:'rgba(220,38,38,0.08)',  color:'#DC2626', border:'rgba(220,38,38,0.2)' },
        free:    { label:'⏭ Free',     bg:'rgba(107,114,128,0.1)', color:'#6B7280', border:'rgba(107,114,128,0.25)' },
    };
    const s = map[status] || map.free;
    return <span style={{ padding:'3px 10px', borderRadius:8, fontSize:'0.72rem', fontWeight:700, background:s.bg, color:s.color, border:`1px solid ${s.border}`, whiteSpace:'nowrap' }}>{s.label}</span>;
}

export default function HodAnalytics() {
    const [data,         setData]        = useState(null);
    const [loading,      setLoading]     = useState(true);
    const [todayStatus,  setTodayStatus] = useState([]);
    const [tsLoading,    setTsLoading]   = useState(true);
    const [filterSec,    setFilterSec]   = useState('');

    useEffect(() => {
        api.get('/hod/analytics')
            .then(r => setData(r.data))
            .catch(console.error)
            .finally(() => setLoading(false));
        api.get('/hod/attendance/today-status')
            .then(r => setTodayStatus(r.data.status || []))
            .catch(() => setTodayStatus([]))
            .finally(() => setTsLoading(false));
    }, []);

    if (loading) return <DashboardLayout><div style={{ padding:60, display:'flex', justifyContent:'center' }}><LoadingSpinner /></div></DashboardLayout>;

    const ls = data?.leave_stats || {};
    const totalStudents = data?.student_breakdown?.reduce((s, b) => s + b.student_count, 0) || 0;

    const byYear = {};
    (data?.student_breakdown || []).forEach(b => {
        if (!byYear[b.year]) byYear[b.year] = [];
        byYear[b.year].push(b);
    });

    const today  = new Date();
    const dayStr = today.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });

    // All unique sections from today's status
    const allSections = [...new Set(todayStatus.map(r => `Y${r.year} ${r.section}`))];
    const filteredTs  = filterSec ? todayStatus.filter(r => `Y${r.year} ${r.section}` === filterSec) : todayStatus;

    // Today summary counts
    const lockedCount  = todayStatus.filter(r => r.status === 'locked').length;
    const pendingCount = todayStatus.filter(r => r.status === 'pending').length;
    const freeCount    = todayStatus.filter(r => r.status === 'free').length;

    return (
        <DashboardLayout>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--text-primary)', margin:0, letterSpacing:'-0.02em' }}>Department Analytics 📊</h1>
                <p style={{ color:'var(--text-secondary)', fontSize:'0.82rem', marginTop:4 }}>Attendance trends, student distribution, leave stats, and cross-department faculty</p>
            </div>

            {/* Top metric cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14, marginBottom:28 }}>
                <StatCard label="Total Students"     value={totalStudents}                       icon={HiOutlineAcademicCap}   color="#1565C0" />
                <StatCard label="Cross-Dept Faculty" value={data?.cross_dept_faculty_count || 0} icon={HiOutlineGlobeAlt}       color="#2E7D32" />
                <StatCard label="Leaves Pending"     value={ls.pending || 0}                     icon={HiOutlineClock}          color="#E65100" />
                <StatCard label="Leaves Approved"    value={ls.approved || 0}                    icon={HiOutlineClipboardCheck} color="#2E7D32" />
                <StatCard label="Leaves Rejected"    value={ls.rejected || 0}                    icon={HiOutlineUserGroup}      color="#B71C1C" />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start', marginBottom:28 }}>
                {/* Student Distribution */}
                <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, padding:20, boxShadow:'var(--shadow-sm)' }}>
                    <h2 style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--text-primary)', marginBottom:16 }}>Student Distribution by Year &amp; Section</h2>
                    {Object.keys(byYear).length === 0 ? (
                        <p style={{ color:'var(--text-tertiary)', fontSize:'0.82rem' }}>No student data available.</p>
                    ) : (
                        Object.entries(byYear).sort().map(([yr, sections]) => (
                            <div key={yr} style={{ marginBottom:12 }}>
                                <p style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>Year {yr}</p>
                                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                                    {sections.sort((a, b) => a.section?.localeCompare(b.section)).map((s, i) => (
                                        <div key={i} style={{ padding:'8px 14px', borderRadius:10, background:`${COLORS[i%COLORS.length]}12`, border:`1px solid ${COLORS[i%COLORS.length]}30` }}>
                                            <p style={{ fontSize:'0.65rem', color:'var(--text-tertiary)', margin:'0 0 2px', fontWeight:600 }}>Section {s.section || '—'}</p>
                                            <p style={{ fontSize:'1.2rem', fontWeight:800, color:COLORS[i%COLORS.length], margin:0 }}>{s.student_count}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Attendance by Subject */}
                <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, padding:20, boxShadow:'var(--shadow-sm)' }}>
                    <h2 style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--text-primary)', marginBottom:16 }}>Attendance Rate by Subject</h2>
                    {!data?.attendance_by_subject?.length ? (
                        <p style={{ color:'var(--text-tertiary)', fontSize:'0.82rem' }}>No attendance data yet.</p>
                    ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                            {data.attendance_by_subject.map((s, i) => {
                                const pct = s.avg_pct || 0;
                                const col = pct >= 75 ? '#2E7D32' : pct >= 60 ? '#E65100' : '#B71C1C';
                                return (
                                    <div key={i}>
                                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                                            <span style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text-primary)' }}>{s.subject_name}</span>
                                            <span style={{ fontSize:'0.78rem', fontWeight:700, color:col }}>{pct}%</span>
                                        </div>
                                        <div style={{ height:8, background:'var(--bg-secondary)', borderRadius:6, overflow:'hidden' }}>
                                            <div style={{ width:`${Math.min(pct,100)}%`, height:'100%', background:col, borderRadius:6, transition:'width 0.5s ease' }} />
                                        </div>
                                        <p style={{ fontSize:'0.65rem', color:'var(--text-tertiary)', marginTop:2 }}>{s.subject_code} · {s.present_count} / {s.total_records} records</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── TODAY'S ATTENDANCE STATUS ─────────────────────────────────── */}
            <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, padding:20, boxShadow:'var(--shadow-sm)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:12 }}>
                    <div>
                        <h2 style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--text-primary)', margin:0 }}>📅 Today's Attendance Status</h2>
                        <p style={{ fontSize:'0.72rem', color:'var(--text-secondary)', marginTop:3 }}>{dayStr} — live period-by-period status across all sections</p>
                    </div>
                    <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                        <span style={{ padding:'3px 12px', borderRadius:8, background:'rgba(22,163,74,0.1)', color:'#16A34A', fontWeight:700, fontSize:'0.75rem', border:'1px solid rgba(22,163,74,0.3)' }}>✅ {lockedCount} Locked</span>
                        <span style={{ padding:'3px 12px', borderRadius:8, background:'rgba(220,38,38,0.08)', color:'#DC2626', fontWeight:700, fontSize:'0.75rem', border:'1px solid rgba(220,38,38,0.2)' }}>🔴 {pendingCount} Pending</span>
                        <span style={{ padding:'3px 12px', borderRadius:8, background:'rgba(107,114,128,0.1)', color:'#6B7280', fontWeight:600, fontSize:'0.75rem', border:'1px solid rgba(107,114,128,0.25)' }}>⏭ {freeCount} Free</span>
                        {allSections.length > 1 && (
                            <select className="form-input" style={{ maxWidth:140, fontSize:'0.78rem', padding:'5px 10px' }} value={filterSec} onChange={e => setFilterSec(e.target.value)}>
                                <option value="">All Sections</option>
                                {allSections.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        )}
                    </div>
                </div>

                {tsLoading ? (
                    <div style={{ padding:30, display:'flex', justifyContent:'center' }}><LoadingSpinner /></div>
                ) : filteredTs.length === 0 ? (
                    <p style={{ color:'var(--text-tertiary)', fontSize:'0.82rem', textAlign:'center', padding:20 }}>
                        No period data available — configure class periods and timetable first.
                    </p>
                ) : (
                    <div style={{ borderRadius:10, overflow:'hidden', border:'1px solid var(--border)' }}>
                        <table className="data-table">
                            <thead>
                                <tr><th>Section</th><th>Period</th><th>Time</th><th>Subject</th><th>Faculty</th><th>Status</th><th>P</th><th>A</th></tr>
                            </thead>
                            <tbody>
                                {filteredTs.map((r, i) => (
                                    <tr key={i} style={{
                                        background: r.status === 'locked' ? 'rgba(22,163,74,0.03)' : r.status === 'pending' ? 'rgba(220,38,38,0.02)' : undefined
                                    }}>
                                        <td style={{ fontWeight:700 }}>Y{r.year} {r.section}</td>
                                        <td style={{ textAlign:'center' }}>
                                            <span style={{ fontWeight:800, color:'#7C3AED', background:'rgba(124,58,237,0.1)', padding:'2px 9px', borderRadius:7, fontSize:'0.78rem' }}>P{r.period_number}</span>
                                        </td>
                                        <td style={{ fontFamily:'monospace', fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                                            {r.start_time ? `${new Date('1970-01-01T'+r.start_time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} – ${new Date('1970-01-01T'+r.end_time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}` : '—'}
                                        </td>
                                        <td style={{ fontSize:'0.82rem' }}>{r.subject_name || <span style={{ color:'var(--text-tertiary)' }}>—</span>}</td>
                                        <td style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>{r.faculty_name || <span style={{ color:'var(--text-tertiary)' }}>—</span>}</td>
                                        <td><StatusBadge status={r.status} /></td>
                                        <td style={{ textAlign:'center', fontWeight:700, color:'#16A34A' }}>{r.present_count ?? '—'}</td>
                                        <td style={{ textAlign:'center', fontWeight:700, color:'#DC2626' }}>{r.absent_count ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
