import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

const DAY_ABBR = { Monday:'Mon', Tuesday:'Tue', Wednesday:'Wed', Thursday:'Thu', Friday:'Fri', Saturday:'Sat', Sunday:'Sun' };

export default function StudentAttendance() {
    const [data,        setData]       = useState(null);
    const [history,     setHistory]    = useState([]);
    const [loading,     setLoading]    = useState(true);
    const [histLoading, setHistLoading] = useState(false);
    const [tab,         setTab]        = useState('summary');

    useEffect(() => {
        (async () => {
            try { const r = await api.get('/student/attendance'); setData(r.data); }
            catch { } finally { setLoading(false); }
        })();
    }, []);

    useEffect(() => {
        if (tab !== 'daywise') return;
        if (history.length > 0) return;
        setHistLoading(true);
        api.get('/student/attendance/day-wise')
            .then(r => setHistory(r.data.history || []))
            .catch(() => setHistory([]))
            .finally(() => setHistLoading(false));
    }, [tab, history.length]);

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    const overall = data?.overall || { total: 0, attended: 0, percentage: 0, fraction: '0/0' };
    const overallColor = overall.percentage >= 75 ? '#16A34A' : overall.percentage >= 65 ? '#D97706' : '#DC2626';
    const overallBg    = overall.percentage >= 75 ? 'rgba(22,163,74,0.08)' : overall.percentage >= 65 ? 'rgba(217,119,6,0.08)' : 'rgba(220,38,38,0.08)';
    const overallBdr   = overall.percentage >= 75 ? 'rgba(22,163,74,0.25)' : overall.percentage >= 65 ? 'rgba(217,119,6,0.25)' : 'rgba(220,38,38,0.25)';

    const tabBtn = (t, label) => (
        <button onClick={() => setTab(t)} style={{
            padding: '9px 20px', borderRadius: 10, fontWeight: 600, fontSize: '0.835rem',
            border: `1.5px solid ${tab === t ? '#1565C0' : 'var(--border)'}`,
            background: tab === t ? 'rgba(21,101,192,0.1)' : 'var(--bg-card)',
            color: tab === t ? '#1565C0' : 'var(--text-primary)',
            cursor: 'pointer', transition: 'all 0.15s ease',
        }}>{label}</button>
    );

    return (
        <DashboardLayout>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>My Attendance</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Subject-wise summary and day-wise history</p>
            </div>

            {/* ── OVERALL ATTENDANCE CARD ────────────────────────────── */}
            <div style={{
                background: overallBg, border: `1.5px solid ${overallBdr}`,
                borderRadius: 16, padding: '20px 24px', marginBottom: 24,
                display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
            }}>
                {/* Big fraction */}
                <div style={{ textAlign: 'center', minWidth: 90 }}>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, color: overallColor, lineHeight: 1 }}>
                        {overall.fraction}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Classes
                    </div>
                </div>

                {/* Divider */}
                <div style={{ width: 1, height: 56, background: overallBdr, flexShrink: 0 }} />

                {/* Percentage + label */}
                <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                        Overall Attendance
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800, color: overallColor, lineHeight: 1.1, marginTop: 2 }}>
                        {overall.percentage}%
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                        {overall.attended} attended out of {overall.total} classes conducted
                    </div>
                </div>

                {/* Status badge */}
                <div style={{
                    padding: '8px 18px', borderRadius: 10, fontWeight: 700,
                    fontSize: '0.82rem', color: overallColor,
                    background: 'var(--bg-card)', border: `1.5px solid ${overallBdr}`,
                }}>
                    {overall.percentage >= 75 ? '✅ On Track' : overall.percentage >= 65 ? '⚠️ At Risk' : '🚨 Below Minimum'}
                </div>
            </div>

            {/* Tabs */}
            <div className="tab-row" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {tabBtn('summary', '📊 Subject Summary')}
                {tabBtn('daywise', '📅 Day-wise History')}
            </div>

            {/* ── SUBJECT SUMMARY ─────────────────────────────────── */}
            {tab === 'summary' && (
                <>
                    <div className="card-table-wrap" style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 28, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Subject</th>
                                    <th>Present</th>
                                    <th>Absent</th>
                                    <th>Late</th>
                                    <th>Leave</th>
                                    <th>Conducted</th>
                                    <th>Attended</th>
                                    <th>Attendance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.subjects || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={8} data-label="" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px 0' }}>
                                            No attendance records yet.
                                        </td>
                                    </tr>
                                ) : (data?.subjects || []).map((s, i) => {
                                    const pct = s.percentage;
                                    const c   = pct >= 75 ? '#16A34A' : pct >= 65 ? '#D97706' : '#DC2626';
                                    const bg  = pct >= 75 ? 'rgba(22,163,74,0.08)' : pct >= 65 ? 'rgba(217,119,6,0.08)' : 'rgba(220,38,38,0.08)';
                                    return (
                                        <tr key={i}>
                                            <td data-label="Subject" style={{ fontWeight: 500 }}>
                                                {s.subject_name}{' '}
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>({s.code})</span>
                                            </td>
                                            <td data-label="Present" style={{ color: '#16A34A', fontWeight: 600 }}>{s.present_count}</td>
                                            <td data-label="Absent" style={{ color: '#DC2626', fontWeight: 600 }}>{s.absent_count}</td>
                                            <td data-label="Late" style={{ color: '#D97706', fontWeight: 600 }}>{s.late_count}</td>
                                            <td data-label="Leave">{s.leave_count}</td>
                                            <td data-label="Conducted" style={{ fontWeight: 600 }}>{s.total}</td>
                                            <td data-label="Attended" style={{ fontWeight: 600 }}>{s.attended}</td>
                                            <td data-label="Attendance">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                    <span style={{
                                                        fontWeight: 700, color: c, fontSize: '0.82rem',
                                                        background: bg, padding: '3px 10px', borderRadius: 8,
                                                        border: `1px solid ${c}30`, whiteSpace: 'nowrap',
                                                    }}>
                                                        {s.fraction}
                                                    </span>
                                                    <span style={{ fontWeight: 700, color: c, fontSize: '0.9rem' }}>
                                                        {pct}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Attendance History</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                        {(data?.calendar || []).slice(0, 28).map((d, i) => {
                            const colors = { present: '#16A34A', absent: '#DC2626', late: '#F59E0B', leave: '#6B7280' };
                            return (
                                <div key={i} title={`${d.subject_name}: ${d.status}`}
                                    style={{ padding: '8px 4px', borderRadius: 10, textAlign: 'center', background: `${colors[d.status]}10`, border: `1px solid ${colors[d.status]}30` }}>
                                    <p style={{ fontWeight: 700, color: colors[d.status], fontSize: '0.875rem' }}>{new Date(d.date).getDate()}</p>
                                    <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.subject_name?.substring(0, 8)}</p>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* ── DAY-WISE HISTORY ────────────────────────────────── */}
            {tab === 'daywise' && (
                histLoading ? (
                    <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div>
                ) : history.length === 0 ? (
                    <div style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '1.6rem', marginBottom: 8 }}>📭</p>
                        <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>No attendance history yet</p>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Once faculty mark attendance, your day-wise records will appear here.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {history.map(day => {
                            const dayLabel = DAY_ABBR[day.day_name] || day.day_name;
                            const dateObj  = new Date(day.date + 'T00:00:00');
                            const dateStr  = dateObj.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
                            const presentCnt = day.records.filter(r => r.status === 'present' || r.status === 'late').length;
                            const absentCnt  = day.records.filter(r => r.status === 'absent').length;

                            return (
                                <div key={day.date} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                                    {/* Date header */}
                                    <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(21,101,192,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ fontSize: '0.55rem', fontWeight: 700, color: '#1565C0', textTransform: 'uppercase', lineHeight: 1 }}>{dayLabel}</span>
                                                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#1565C0', lineHeight: 1 }}>{dateObj.getDate()}</span>
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: '0.9rem' }}>{dayLabel}, {dateStr}</p>
                                                <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: 0 }}>{day.records.length} period{day.records.length !== 1 ? 's' : ''}</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 10 }}>
                                            <span style={{ padding: '3px 12px', borderRadius: 8, background: 'rgba(22,163,74,0.1)', color: '#16A34A', fontWeight: 700, fontSize: '0.78rem', border: '1px solid rgba(22,163,74,0.25)' }}>✅ {presentCnt} Present</span>
                                            {absentCnt > 0 && <span style={{ padding: '3px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', color: '#DC2626', fontWeight: 700, fontSize: '0.78rem', border: '1px solid rgba(220,38,38,0.2)' }}>❌ {absentCnt} Absent</span>}
                                        </div>
                                    </div>

                                    {/* Period rows */}
                                    <div style={{ padding: '8px 0' }}>
                                        {day.records.map((rec, ri) => {
                                            const isPresent  = rec.status === 'present' || rec.status === 'late';
                                            const isAbsent   = rec.status === 'absent';
                                            const rowBg      = isPresent ? 'rgba(22,163,74,0.04)' : isAbsent ? 'rgba(220,38,38,0.04)' : 'transparent';
                                            const statusIcon  = isPresent ? '✅' : isAbsent ? '❌' : '📝';
                                            const statusColor = isPresent ? '#16A34A' : isAbsent ? '#DC2626' : '#6B7280';

                                            return (
                                                <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 18px', background: rowBg, borderBottom: ri < day.records.length - 1 ? '1px solid var(--border)' : 'none', flexWrap: 'wrap' }}>
                                                    {rec.period_number && (
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7C3AED', background: 'rgba(124,58,237,0.1)', padding: '2px 9px', borderRadius: 7, flexShrink: 0 }}>P{rec.period_number}</span>
                                                    )}
                                                    {(rec.start_time && rec.end_time) && (
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: 'monospace', flexShrink: 0 }}>{rec.start_time} – {rec.end_time}</span>
                                                    )}
                                                    <div style={{ flex: 1, minWidth: 120 }}>
                                                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{rec.subject_name}</span>
                                                        {rec.subject_code && <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{rec.subject_code}</span>}
                                                    </div>
                                                    {rec.faculty_name && (
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{rec.faculty_name}</span>
                                                    )}
                                                    <span style={{ fontWeight: 700, color: statusColor, fontSize: '0.82rem', flexShrink: 0 }}>
                                                        {statusIcon} {rec.status === 'late' ? 'Late' : rec.status.charAt(0).toUpperCase() + rec.status.slice(1)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}
        </DashboardLayout>
    );
}
