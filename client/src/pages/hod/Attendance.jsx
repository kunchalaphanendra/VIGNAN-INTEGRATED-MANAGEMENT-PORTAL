import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

function pctColor(p) { return p >= 75 ? '#16A34A' : p >= 60 ? '#F59E0B' : '#DC2626'; }

function PctBar({ pct }) {
    const c = pctColor(pct);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)' }}>
                <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', borderRadius: 3, background: c }} />
            </div>
            <span style={{ fontWeight: 700, color: c, fontSize: '0.85rem', minWidth: 44 }}>{pct}%</span>
        </div>
    );
}

function severityBadge(mins) {
    const abs = Math.abs(mins || 0);
    if (abs <= 30)  return { label: 'Minor',       bg: 'rgba(245,158,11,0.12)', color: '#B45309', border: 'rgba(245,158,11,0.3)' };
    if (abs <= 120) return { label: 'Moderate',    bg: 'rgba(220,38,38,0.08)', color: '#DC2626', border: 'rgba(220,38,38,0.25)' };
    return              { label: 'Significant', bg: 'rgba(127,0,0,0.09)',   color: '#7F0000', border: 'rgba(127,0,0,0.25)' };
}

function Toast({ msg, type = 'success', onDone }) {
    useEffect(() => { const t = setTimeout(onDone, 4500); return () => clearTimeout(t); }, [onDone]);
    const bg = type === 'error' ? '#B91C1C' : type === 'warn' ? '#B45309' : '#2E7D32';
    return (
        <div style={{ position:'fixed', bottom:28, right:28, zIndex:9999, background:bg, color:'white',
            borderRadius:12, padding:'13px 22px', boxShadow:'0 8px 32px rgba(0,0,0,0.22)',
            fontSize:'0.875rem', fontWeight:600, maxWidth:440, animation:'slideUp 0.3s ease' }}>
            {msg}
        </div>
    );
}

export default function HodAttendance() {
    const [summary,       setSummary]       = useState([]);
    const [defaulters,    setDefaulters]    = useState([]);
    const [audit,         setAudit]         = useState([]);
    const [locks,         setLocks]         = useState([]);
    const [locksDate,     setLocksDate]     = useState(new Date().toLocaleDateString('en-CA'));
    const [locksLoading,  setLocksLoading]  = useState(false);
    const [loading,       setLoading]       = useState(true);
    const [tab,           setTab]           = useState('summary');
    const [search,        setSearch]        = useState('');
    const [filterYear,    setFilterYear]    = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [filterBand,    setFilterBand]    = useState('');
    const [confirming,    setConfirming]    = useState(null);
    const [unlockTarget,  setUnlockTarget]  = useState(null);
    const [unlockingId,   setUnlockingId]   = useState(null);
    const [toast,         setToast]         = useState(null);
    // Offline conflicts
    const [conflicts,     setConflicts]     = useState([]);
    const [conflictsLoaded, setConflictsLoaded] = useState(false);
    const [resolving,     setResolving]     = useState(null); // conflict id being resolved

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const [s, d, a] = await Promise.all([
                api.get('/hod/attendance/summary'),
                api.get('/hod/attendance/defaulters'),
                api.get('/hod/attendance/audit'),
            ]);
            setSummary(s.data.summary || []);
            setDefaulters(d.data.defaulters || []);
            setAudit(a.data.audit || []);
        } catch { } finally { setLoading(false); }
    };

    const loadLocks = useCallback(async (date) => {
        setLocksLoading(true);
        try {
            const r = await api.get(`/hod/attendance/period-locks?date=${date}`);
            setLocks(r.data.locks || []);
        } catch { setLocks([]); } finally { setLocksLoading(false); }
    }, []);

    useEffect(() => {
        if (tab === 'locks') loadLocks(locksDate);
        if (tab === 'conflicts' && !conflictsLoaded) loadConflicts();
    }, [tab, locksDate, loadLocks]);

    const loadConflicts = async () => {
        try {
            const r = await api.get('/hod/attendance-conflicts');
            setConflicts(r.data.conflicts || []);
            setConflictsLoaded(true);
        } catch { setConflicts([]); setConflictsLoaded(true); }
    };

    const handleResolve = async (conflictId, resolution) => {
        setResolving(conflictId);
        try {
            await api.post(`/hod/attendance-conflicts/${conflictId}/resolve`, { resolution });
            setConflicts(prev => prev.filter(c => c.id !== conflictId));
            const label = resolution === 'faculty_a' ? 'Original (online) attendance kept.' : 'Offline submission accepted.';
            setToast({ msg: `✅ Conflict resolved — ${label}`, type: 'success' });
        } catch (err) {
            setToast({ msg: '❌ Failed: ' + (err.response?.data?.error || err.message), type: 'error' });
        } finally { setResolving(null); }
    };

    const handleConfirm = async (sessionId) => {
        setConfirming(sessionId);
        try {
            await api.patch(`/hod/attendance/audit/confirm/${sessionId}`);
            setAudit(prev => prev.map(r => r.session_id === sessionId ? { ...r, hod_confirmed: 1 } : r));
            setToast({ msg: '✅ Session confirmed — attendance now counts.', type: 'success' });
        } catch (err) {
            alert('Failed to confirm: ' + (err.response?.data?.error || err.message));
        } finally { setConfirming(null); }
    };

    const handleUnlock = async () => {
        if (!unlockTarget) return;
        setUnlockingId(unlockTarget.session_id);
        try {
            await api.delete(`/hod/attendance/period-locks/${unlockTarget.session_id}`);
            setLocks(prev => prev.filter(l => l.session_id !== unlockTarget.session_id));
            setToast({ msg: `🔓 Period ${unlockTarget.period_number} unlocked for Y${unlockTarget.year} Sec ${unlockTarget.section}. Faculty can now re-enter attendance.`, type: 'warn' });
        } catch (err) {
            setToast({ msg: '❌ Failed: ' + (err.response?.data?.error || err.message), type: 'error' });
        } finally { setUnlockingId(null); setUnlockTarget(null); }
    };

    const tabBtn = (t, label, accent = '#2E7D32', badge = null) => (
        <button onClick={() => setTab(t)} style={{
            padding: '9px 20px', borderRadius: 10, fontWeight: 600, fontSize: '0.835rem',
            border: `1.5px solid ${tab === t ? accent : 'var(--border)'}`,
            background: tab === t ? `${accent}1A` : 'var(--bg-card)',
            color: tab === t ? accent : 'var(--text-primary)',
            cursor: 'pointer', transition: 'all 0.15s ease',
        }}>
            {label}
            {badge != null && badge > 0 && (
                <span style={{ marginLeft:8, padding:'1px 7px', borderRadius:100, fontSize:'0.7rem', fontWeight:800, background:`${accent}22`, color:accent }}>{badge}</span>
            )}
        </button>
    );

    const filteredDef = defaulters.filter(r => {
        const ms = !search || r.full_name?.toLowerCase().includes(search.toLowerCase()) || r.roll_number?.toLowerCase().includes(search.toLowerCase());
        const my = !filterYear    || String(r.year) === filterYear;
        const mc = !filterSection || r.section === filterSection;
        const mb = !filterBand || (filterBand === 'critical' && r.percentage < 60) || (filterBand === 'low' && r.percentage >= 60 && r.percentage < 75);
        return ms && my && mc && mb;
    });

    const totalStudents  = [...new Set(defaulters.map(r => r.roll_number))].length;
    const critical       = defaulters.filter(r => r.percentage < 60).length;
    const low            = defaulters.filter(r => r.percentage >= 60 && r.percentage < 75).length;
    const pendingAudit   = audit.filter(r => !r.hod_confirmed).length;
    const confirmedAudit = audit.filter(r =>  r.hod_confirmed).length;
    const isToday        = locksDate === new Date().toLocaleDateString('en-CA');
    const pendingConflicts = conflicts.length;

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <style>{`@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
            {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

            {/* ─── Unlock Confirmation Dialog ─── */}
            {unlockTarget && (
                <div style={{ position:'fixed', inset:0, zIndex:8000, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ background:'var(--bg-card)', borderRadius:18, padding:'28px 32px', maxWidth:460, width:'90%', boxShadow:'0 20px 60px rgba(0,0,0,0.3)', border:'1px solid var(--border)' }}>
                        <p style={{ fontSize:'1rem', fontWeight:800, color:'var(--text-primary)', marginBottom:10 }}>
                            🔓 Unlock Period {unlockTarget.period_number} — {unlockTarget.subject_name}?
                        </p>
                        <p style={{ fontSize:'0.85rem', color:'var(--text-secondary)', lineHeight:1.6, marginBottom:22 }}>
                            Unlocking <strong>Y{unlockTarget.year} Sec {unlockTarget.section} · Period {unlockTarget.period_number}</strong> will{' '}
                            <strong style={{ color:'#DC2626' }}>delete all attendance records</strong> for this period so faculty can re-enter them.
                        </p>
                        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                            <button onClick={() => setUnlockTarget(null)} style={{ padding:'9px 22px', borderRadius:9, border:'1px solid var(--border)', background:'var(--bg-secondary)', fontWeight:600, cursor:'pointer', fontSize:'0.85rem' }}>
                                Cancel
                            </button>
                            <button onClick={handleUnlock} disabled={!!unlockingId} style={{ padding:'9px 22px', borderRadius:9, border:'none', background:'#DC2626', color:'white', fontWeight:700, cursor: unlockingId ? 'not-allowed' : 'pointer', fontSize:'0.85rem', boxShadow:'0 4px 12px rgba(220,38,38,0.35)', opacity: unlockingId ? 0.7 : 1 }}>
                                {unlockingId ? 'Unlocking…' : 'Yes, Unlock'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>Attendance</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Department-wide attendance · data matches student portal</p>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                    { label: 'Defaulter Students', value: totalStudents,  color: 'var(--text-primary)' },
                    { label: 'Critical (<60%)',     value: critical,       color: '#DC2626' },
                    { label: 'Low (60–74%)',        value: low,            color: '#F59E0B' },
                    { label: 'Total Subjects',      value: summary.length, color: '#1565C0' },
                    ...(audit.length > 0 ? [
                        { label: '⚠ Pending Confirm', value: pendingAudit,   color: '#B45309', hl: pendingAudit > 0 },
                        { label: '✅ HOD Confirmed',   value: confirmedAudit, color: '#16A34A' },
                    ] : []),
                    { label: '🔒 Locked Today',    value: locks.length,   color: '#7C3AED' },
                    ...(pendingConflicts > 0 ? [{ label: '⚡ Sync Conflicts', value: pendingConflicts, color: '#DC2626', hl: true }] : []),
                ].map(({ label, value, color, hl }) => (
                    <div key={label} style={{ padding: '12px 18px', borderRadius: 12, background: hl ? 'rgba(245,158,11,0.06)' : 'var(--bg-card)', border: hl ? '1.5px solid rgba(245,158,11,0.35)' : '1px solid var(--border)', minWidth: 130 }}>
                        <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', margin: '0 0 4px' }}>{label}</p>
                        <p style={{ fontSize: '1.2rem', fontWeight: 800, color, margin: 0 }}>{value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                {tabBtn('summary',   '📊 Subject Summary', '#2E7D32')}
                {tabBtn('defaulters','🔴 Defaulters',      '#DC2626', defaulters.length)}
                <button onClick={() => setTab('audit')} style={{
                    padding:'9px 20px', borderRadius:10, fontWeight:600, fontSize:'0.835rem',
                    border:`1.5px solid ${tab==='audit'?'#B45309':'rgba(245,158,11,0.4)'}`,
                    background: tab==='audit' ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.05)',
                    color:'#B45309', cursor:'pointer', transition:'all 0.15s ease',
                }}>
                    ⚠ Audit Log
                    {pendingAudit > 0 && <span style={{ marginLeft:8, padding:'1px 7px', borderRadius:100, fontSize:'0.7rem', fontWeight:800, background:'rgba(245,158,11,0.2)', color:'#B45309' }}>{pendingAudit}</span>}
                </button>
                <button onClick={() => setTab('locks')} style={{
                    padding:'9px 20px', borderRadius:10, fontWeight:600, fontSize:'0.835rem',
                    border:`1.5px solid ${tab==='locks'?'#7C3AED':'rgba(124,58,237,0.35)'}`,
                    background: tab==='locks' ? 'rgba(124,58,237,0.1)' : 'rgba(124,58,237,0.04)',
                    color:'#7C3AED', cursor:'pointer', transition:'all 0.15s ease',
                }}>
                    🔒 Period Locks
                </button>
                <button onClick={() => { setTab('conflicts'); if (!conflictsLoaded) loadConflicts(); }} style={{
                    padding:'9px 20px', borderRadius:10, fontWeight:600, fontSize:'0.835rem',
                    border:`1.5px solid ${tab==='conflicts'?'#DC2626':'rgba(220,38,38,0.35)'}`,
                    background: tab==='conflicts' ? 'rgba(220,38,38,0.1)' : 'rgba(220,38,38,0.04)',
                    color:'#DC2626', cursor:'pointer', transition:'all 0.15s ease', position:'relative',
                }}>
                    ⚡ Sync Conflicts
                    {pendingConflicts > 0 && <span style={{ marginLeft:8, padding:'1px 7px', borderRadius:100, fontSize:'0.7rem', fontWeight:800, background:'rgba(220,38,38,0.18)', color:'#DC2626' }}>{pendingConflicts}</span>}
                </button>
            </div>

            {/* ── SUBJECT SUMMARY ───────────────────────────────────────────── */}
            {tab === 'summary' && (
                summary.length === 0 ? (
                    <div style={{ padding:40, textAlign:'center', background:'var(--bg-card)', borderRadius:14, border:'1px solid var(--border)' }}>
                        <p style={{ color:'var(--text-secondary)' }}>No attendance data yet.</p>
                    </div>
                ) : (
                    <div style={{ borderRadius:14, overflow:'hidden', background:'var(--bg-card)', border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)' }}>
                        <table className="data-table">
                            <thead><tr><th>Subject</th><th>Code</th><th>Faculty</th><th>Year</th><th>Section</th><th>Students</th><th>Avg Attendance</th></tr></thead>
                            <tbody>
                                {summary.map((r, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight:600 }}>{r.subject_name}</td>
                                        <td><span style={{ fontFamily:'monospace', fontSize:'0.78rem' }}>{r.code}</span></td>
                                        <td style={{ fontSize:'0.82rem', color:'var(--text-secondary)' }}>{r.faculty_name}</td>
                                        <td style={{ textAlign:'center' }}>Y{r.year}</td>
                                        <td style={{ textAlign:'center' }}>{r.section}</td>
                                        <td style={{ textAlign:'center' }}>{r.total_students}</td>
                                        <td><PctBar pct={r.avg_attendance || 0} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            )}

            {/* ── DEFAULTERS ────────────────────────────────────────────────── */}
            {tab === 'defaulters' && (
                <>
                    <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                        <input className="form-input" style={{ maxWidth:200 }} placeholder="Search name / roll..." value={search} onChange={e => setSearch(e.target.value)} />
                        <select className="form-input" style={{ maxWidth:120 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                            <option value="">All Years</option>
                            {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
                        </select>
                        <select className="form-input" style={{ maxWidth:120 }} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                            <option value="">All Sections</option>
                            {['A','B','C','D'].map(s => <option key={s} value={s}>Section {s}</option>)}
                        </select>
                        <select className="form-input" style={{ maxWidth:160 }} value={filterBand} onChange={e => setFilterBand(e.target.value)}>
                            <option value="">All Defaulters</option>
                            <option value="critical">Critical (&lt;60%)</option>
                            <option value="low">Low (60–74%)</option>
                        </select>
                    </div>
                    {filteredDef.length === 0 ? (
                        <div style={{ padding:40, textAlign:'center', background:'var(--bg-card)', borderRadius:14, border:'1px solid var(--border)' }}>
                            <p style={{ color:'var(--text-secondary)' }}>🎉 No defaulters found!</p>
                        </div>
                    ) : (
                        <div style={{ borderRadius:14, overflow:'hidden', background:'var(--bg-card)', border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)' }}>
                            <table className="data-table">
                                <thead><tr><th>Name</th><th>Roll No</th><th>Year / Sec</th><th>Subject</th><th>P</th><th>A</th><th>L</th><th>Total</th><th>Attendance %</th></tr></thead>
                                <tbody>
                                    {filteredDef.map((r, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight:600 }}>{r.full_name}</td>
                                            <td><span style={{ fontFamily:'monospace', fontWeight:600 }}>{r.roll_number}</span></td>
                                            <td style={{ textAlign:'center', fontSize:'0.82rem' }}>Y{r.year} {r.section}</td>
                                            <td style={{ fontSize:'0.82rem' }}>{r.subject_name}</td>
                                            <td style={{ color:'#16A34A', fontWeight:600, textAlign:'center' }}>{r.present_count ?? r.attended}</td>
                                            <td style={{ color:'#DC2626', fontWeight:600, textAlign:'center' }}>{r.absent_count ?? (r.total - r.attended)}</td>
                                            <td style={{ color:'#6B7280', textAlign:'center' }}>{r.leave_count ?? 0}</td>
                                            <td style={{ textAlign:'center' }}>{r.total}</td>
                                            <td><PctBar pct={r.percentage} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ── AUDIT LOG ─────────────────────────────────────────────────── */}
            {tab === 'audit' && (
                <>
                    {audit.length === 0 ? (
                        <div style={{ padding:48, textAlign:'center', background:'var(--bg-card)', borderRadius:14, border:'1px solid var(--border)' }}>
                            <p style={{ fontSize:'1.8rem', marginBottom:10 }}>✅</p>
                            <p style={{ fontWeight:700, color:'var(--text-primary)', fontSize:'0.95rem', marginBottom:6 }}>No outside-window sessions</p>
                            <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)', lineHeight:1.6 }}>
                                When a faculty member marks attendance <strong>outside the configured period window</strong>, it will appear here.<br />
                                Unconfirmed entries <strong>do not count</strong> in student percentage calculations.
                            </p>
                        </div>
                    ) : (
                        <>
                            {pendingAudit > 0 && (
                                <div style={{ padding:'14px 18px', borderRadius:12, marginBottom:18, background:'rgba(245,158,11,0.07)', border:'1.5px solid rgba(245,158,11,0.3)', display:'flex', gap:12, alignItems:'flex-start' }}>
                                    <span style={{ fontSize:'1.2rem', marginTop:1 }}>⚠</span>
                                    <div>
                                        <p style={{ margin:0, fontWeight:700, color:'#92400E', fontSize:'0.9rem' }}>{pendingAudit} session{pendingAudit!==1?'s':''} pending your confirmation</p>
                                        <p style={{ margin:'4px 0 0', fontSize:'0.78rem', color:'#78350F', lineHeight:1.5 }}>Records submitted <strong>outside the period window</strong> will <strong>NOT count</strong> until confirmed.</p>
                                    </div>
                                </div>
                            )}
                            {confirmedAudit > 0 && pendingAudit === 0 && (
                                <div style={{ padding:'12px 18px', borderRadius:12, marginBottom:18, background:'rgba(22,163,74,0.07)', border:'1.5px solid rgba(22,163,74,0.3)', display:'flex', gap:12, alignItems:'center' }}>
                                    <span>✅</span>
                                    <p style={{ margin:0, fontWeight:700, color:'#166534', fontSize:'0.88rem' }}>All outside-window sessions confirmed.</p>
                                </div>
                            )}
                            <div style={{ borderRadius:14, overflow:'hidden', background:'var(--bg-card)', border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)' }}>
                                <table className="data-table">
                                    <thead><tr><th>Status</th><th>Date</th><th>Faculty</th><th>Subject</th><th>Yr/Sec</th><th>Period</th><th>Window</th><th>Submitted</th><th>Deviation</th><th>Students</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {audit.map((r) => {
                                            const confirmed    = !!r.hod_confirmed;
                                            const sev          = severityBadge(r.mins_from_start);
                                            const isBefore     = (r.mins_from_start || 0) < 0;
                                            const devColor     = isBefore ? '#1565C0' : '#B45309';
                                            const isConfirming = confirming === r.session_id;
                                            return (
                                                <tr key={r.session_id} style={{ background: confirmed ? 'rgba(22,163,74,0.03)' : 'rgba(245,158,11,0.03)', opacity: isConfirming ? 0.6 : 1 }}>
                                                    <td>{confirmed
                                                        ? <span style={{ padding:'4px 10px', borderRadius:8, fontSize:'0.72rem', fontWeight:700, background:'rgba(22,163,74,0.12)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.25)' }}>✅ Confirmed</span>
                                                        : <span style={{ padding:'4px 10px', borderRadius:8, fontSize:'0.72rem', fontWeight:700, background:'rgba(245,158,11,0.12)', color:'#B45309', border:'1px solid rgba(245,158,11,0.3)' }}>🕐 Pending</span>}
                                                    </td>
                                                    <td style={{ fontFamily:'monospace', fontWeight:600, fontSize:'0.8rem' }}>{r.session_date}</td>
                                                    <td><div style={{ fontWeight:600, fontSize:'0.85rem' }}>{r.faculty_name}</div><div style={{ fontSize:'0.7rem', color:'var(--text-tertiary)', fontFamily:'monospace' }}>{r.faculty_login}</div></td>
                                                    <td><div style={{ fontWeight:600, fontSize:'0.85rem' }}>{r.subject_name}</div><div style={{ fontSize:'0.7rem', color:'var(--text-tertiary)', fontFamily:'monospace' }}>{r.subject_code}</div></td>
                                                    <td style={{ textAlign:'center', fontSize:'0.82rem' }}>Y{r.year} {r.section}</td>
                                                    <td style={{ textAlign:'center' }}><span style={{ fontWeight:800, color:'#1565C0', background:'rgba(21,101,192,0.1)', padding:'2px 10px', borderRadius:8, fontSize:'0.8rem' }}>P{r.period_number}</span></td>
                                                    <td style={{ fontSize:'0.75rem', fontFamily:'monospace', color:'var(--text-secondary)', lineHeight:1.7 }}>{r.period_start} – {r.period_end}<br /><span style={{ color:'var(--text-tertiary)', fontSize:'0.68rem' }}>-{r.window_open_before??5}m / +{r.window_close_after??10}m</span></td>
                                                    <td style={{ fontFamily:'monospace', fontWeight:600, color:devColor, fontSize:'0.82rem' }}>{r.submitted_time}</td>
                                                    <td><div style={{ display:'flex', flexDirection:'column', gap:3 }}><span style={{ fontSize:'0.8rem', fontWeight:600, color:devColor }}>{isBefore?`${Math.abs(r.mins_from_start)}m early`:`${r.mins_from_start}m late`}</span><span style={{ padding:'2px 7px', borderRadius:6, fontSize:'0.68rem', fontWeight:700, background:sev.bg, color:sev.color, border:`1px solid ${sev.border}`, alignSelf:'flex-start' }}>{sev.label}</span></div></td>
                                                    <td style={{ textAlign:'center', fontWeight:600 }}>{r.student_count}</td>
                                                    <td>{confirmed
                                                        ? <span style={{ fontSize:'0.75rem', color:'#16A34A', fontWeight:600 }}>Counts ✓</span>
                                                        : <button onClick={() => handleConfirm(r.session_id)} disabled={isConfirming} style={{ padding:'7px 16px', borderRadius:9, border:'none', background:isConfirming?'var(--border)':'linear-gradient(135deg,#2E7D32,#4CAF50)', color:'white', fontWeight:700, fontSize:'0.78rem', cursor:isConfirming?'not-allowed':'pointer', whiteSpace:'nowrap' }}>{isConfirming?'…':'Confirm'}</button>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ display:'flex', gap:16, marginTop:14, flexWrap:'wrap', alignItems:'center' }}>
                                {[{label:'Minor (≤30m)',bg:'rgba(245,158,11,0.12)',color:'#B45309',border:'rgba(245,158,11,0.3)'},{label:'Moderate (30–120m)',bg:'rgba(220,38,38,0.08)',color:'#DC2626',border:'rgba(220,38,38,0.25)'},{label:'Significant (>2h)',bg:'rgba(127,0,0,0.09)',color:'#7F0000',border:'rgba(127,0,0,0.25)'}].map(b=>(
                                    <span key={b.label} style={{ padding:'2px 8px', borderRadius:6, fontSize:'0.72rem', fontWeight:700, background:b.bg, color:b.color, border:`1px solid ${b.border}` }}>{b.label}</span>
                                ))}
                                <span style={{ fontSize:'0.75rem', color:'var(--text-tertiary)' }}>· Unconfirmed sessions do not count toward attendance %</span>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* ── PERIOD LOCKS ──────────────────────────────────────────────── */}
            {tab === 'locks' && (
                <>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18, flexWrap:'wrap' }}>
                        <label style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--text-secondary)' }}>View locks for date:</label>
                        <input type="date" className="form-input" style={{ maxWidth:180 }}
                            value={locksDate}
                            max={new Date().toLocaleDateString('en-CA')}
                            onChange={e => setLocksDate(e.target.value)}
                        />
                        {isToday
                            ? <span style={{ padding:'4px 12px', borderRadius:8, background:'rgba(124,58,237,0.1)', color:'#7C3AED', fontWeight:700, fontSize:'0.78rem', border:'1px solid rgba(124,58,237,0.3)' }}>📅 Today — unlocking enabled</span>
                            : <span style={{ padding:'4px 12px', borderRadius:8, background:'rgba(107,114,128,0.08)', color:'#6B7280', fontWeight:600, fontSize:'0.78rem', border:'1px solid rgba(107,114,128,0.2)' }}>📖 Past date — read only</span>
                        }
                    </div>

                    {locksLoading ? (
                        <div style={{ padding:40, textAlign:'center', background:'var(--bg-card)', borderRadius:14, border:'1px solid var(--border)' }}><LoadingSpinner /></div>
                    ) : locks.length === 0 ? (
                        <div style={{ padding:48, textAlign:'center', background:'var(--bg-card)', borderRadius:14, border:'1px solid var(--border)' }}>
                            <p style={{ fontSize:'1.8rem', marginBottom:10 }}>🔓</p>
                            <p style={{ fontWeight:700, color:'var(--text-primary)', fontSize:'0.95rem', marginBottom:6 }}>No locked periods for {locksDate}</p>
                            <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)' }}>Periods lock automatically when faculty save attendance and reset at midnight.</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ borderRadius:14, overflow:'hidden', background:'var(--bg-card)', border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Section</th><th>Period</th><th>Subject</th><th>Locked By</th>
                                            <th>Locked At</th><th>✓ Present</th><th>✗ Absent</th><th>OOW</th>
                                            {isToday && <th>Action</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {locks.map(l => (
                                            <tr key={l.session_id} style={{ background: l.outside_window ? 'rgba(245,158,11,0.03)' : undefined }}>
                                                <td style={{ fontWeight:700 }}>Y{l.year} · Sec {l.section}</td>
                                                <td style={{ textAlign:'center' }}>
                                                    <span style={{ fontWeight:800, color:'#7C3AED', background:'rgba(124,58,237,0.1)', padding:'2px 10px', borderRadius:8, fontSize:'0.8rem' }}>P{l.period_number}</span>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight:600, fontSize:'0.85rem' }}>{l.subject_name}</div>
                                                    <div style={{ fontSize:'0.7rem', color:'var(--text-tertiary)', fontFamily:'monospace' }}>{l.subject_code}</div>
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight:600, fontSize:'0.85rem' }}>{l.faculty_name}</div>
                                                    <div style={{ fontSize:'0.7rem', color:'var(--text-tertiary)', fontFamily:'monospace' }}>{l.faculty_login}</div>
                                                </td>
                                                <td style={{ fontFamily:'monospace', fontWeight:600, fontSize:'0.82rem' }}>{l.locked_at}</td>
                                                <td style={{ textAlign:'center', fontWeight:700, color:'#16A34A' }}>{l.present_count ?? '—'}</td>
                                                <td style={{ textAlign:'center', fontWeight:700, color:'#DC2626' }}>{l.absent_count ?? '—'}</td>
                                                <td style={{ textAlign:'center' }}>
                                                    {l.outside_window
                                                        ? <span style={{ padding:'2px 8px', borderRadius:6, fontSize:'0.7rem', fontWeight:700, background:'rgba(245,158,11,0.12)', color:'#B45309', border:'1px solid rgba(245,158,11,0.3)' }}>⚠ Yes</span>
                                                        : <span style={{ padding:'2px 8px', borderRadius:6, fontSize:'0.7rem', fontWeight:600, background:'rgba(22,163,74,0.1)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.25)' }}>✓ In-window</span>
                                                    }
                                                </td>
                                                {isToday && (
                                                    <td>
                                                        <button onClick={() => setUnlockTarget(l)} disabled={!!unlockingId} style={{ padding:'7px 14px', borderRadius:9, border:'1.5px solid #DC2626', background:'rgba(220,38,38,0.07)', color:'#DC2626', fontWeight:700, fontSize:'0.78rem', cursor:'pointer', whiteSpace:'nowrap', opacity: unlockingId ? 0.5 : 1 }}>
                                                            🔓 Unlock
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p style={{ fontSize:'0.75rem', color:'var(--text-tertiary)', marginTop:12 }}>
                                {locks.length} period{locks.length!==1?'s':''} locked · OOW = Outside period window · Unlocking deletes attendance records so faculty can re-enter
                            </p>
                        </>
                    )}
                </>
            )}
            {/* ── SYNC CONFLICTS ────────────────────────────────────────────── */}
            {tab === 'conflicts' && (
                <>
                    <div style={{ padding:'14px 18px', borderRadius:12, marginBottom:18, background:'rgba(220,38,38,0.06)', border:'1.5px solid rgba(220,38,38,0.25)', display:'flex', gap:12, alignItems:'flex-start' }}>
                        <span style={{ fontSize:'1.2rem' }}>⚡</span>
                        <div>
                            <p style={{ margin:0, fontWeight:700, color:'#991B1B', fontSize:'0.9rem' }}>What are sync conflicts?</p>
                            <p style={{ margin:'4px 0 0', fontSize:'0.78rem', color:'#7F1D1D', lineHeight:1.6 }}>
                                When a faculty marks attendance <strong>offline</strong> (no internet) and later syncs — if another faculty had already marked the <strong>same period</strong> online, this creates a conflict.
                                You must decide which submission to keep.
                            </p>
                        </div>
                    </div>

                    {conflicts.length === 0 ? (
                        <div style={{ padding:56, textAlign:'center', background:'var(--bg-card)', borderRadius:14, border:'1px solid var(--border)' }}>
                            <p style={{ fontSize:'2rem', marginBottom:10 }}>✅</p>
                            <p style={{ fontWeight:700, color:'var(--text-primary)', fontSize:'0.95rem', marginBottom:6 }}>No pending conflicts</p>
                            <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)' }}>When offline attendance clashes with an existing submission, it will appear here for your review.</p>
                        </div>
                    ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                            {conflicts.map(c => {
                                const isRes = resolving === c.id;
                                const bRecords = typeof c.faculty_b_records === 'string'
                                    ? (() => { try { return JSON.parse(c.faculty_b_records); } catch { return []; } })()
                                    : (c.faculty_b_records || []);
                                const bPresent = bRecords.filter(r => r.status === 'present' || r.status === 'late').length;
                                const bAbsent  = bRecords.length - bPresent;
                                return (
                                    <div key={c.id} style={{ borderRadius:14, border:'1.5px solid rgba(220,38,38,0.3)', background:'var(--bg-card)', overflow:'hidden', boxShadow:'var(--shadow-sm)', opacity: isRes ? 0.6 : 1 }}>
                                        {/* Header bar */}
                                        <div style={{ padding:'12px 20px', background:'rgba(220,38,38,0.06)', borderBottom:'1px solid rgba(220,38,38,0.2)', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
                                            <span style={{ fontWeight:800, fontSize:'0.9rem', color:'#991B1B' }}>⚡ Conflict #{c.id}</span>
                                            <span style={{ padding:'3px 10px', borderRadius:8, fontFamily:'monospace', fontSize:'0.78rem', fontWeight:700, background:'rgba(21,101,192,0.1)', color:'#1565C0' }}>P{c.period_number}</span>
                                            <span style={{ fontSize:'0.82rem', color:'var(--text-secondary)', fontWeight:600 }}>{c.session_date} · Y{c.year} Sec {c.section}</span>
                                            {c.saved_at_offline && <span style={{ fontSize:'0.72rem', color:'var(--text-tertiary)' }}>Saved offline at {new Date(c.saved_at_offline).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>}
                                        </div>

                                        {/* Side-by-side comparison */}
                                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
                                            {/* Faculty A — online submission */}
                                            <div style={{ padding:'16px 20px', borderRight:'1px solid var(--border)' }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                                                    <span style={{ padding:'3px 10px', borderRadius:8, fontSize:'0.7rem', fontWeight:800, background:'rgba(22,163,74,0.1)', color:'#16A34A', border:'1px solid rgba(22,163,74,0.3)' }}>ORIGINAL (Online)</span>
                                                </div>
                                                <p style={{ margin:0, fontWeight:800, fontSize:'0.9rem', color:'var(--text-primary)' }}>{c.faculty_a_name}</p>
                                                <p style={{ margin:'4px 0 0', fontSize:'0.75rem', color:'var(--text-secondary)' }}>Submitted online — currently in the database</p>
                                                <button
                                                    onClick={() => handleResolve(c.id, 'faculty_a')}
                                                    disabled={isRes}
                                                    style={{ marginTop:14, width:'100%', padding:'10px', borderRadius:10, border:'none', background:isRes?'var(--border)':'linear-gradient(135deg,#16A34A,#4ADE80)', color:'white', fontWeight:700, fontSize:'0.82rem', cursor:isRes?'not-allowed':'pointer', boxShadow:'0 3px 10px rgba(22,163,74,0.3)' }}
                                                >
                                                    {isRes ? 'Resolving…' : '✅ Keep Original (Online)'}
                                                </button>
                                            </div>

                                            {/* Faculty B — offline submission */}
                                            <div style={{ padding:'16px 20px' }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                                                    <span style={{ padding:'3px 10px', borderRadius:8, fontSize:'0.7rem', fontWeight:800, background:'rgba(245,158,11,0.1)', color:'#B45309', border:'1px solid rgba(245,158,11,0.3)' }}>OFFLINE Submission</span>
                                                </div>
                                                <p style={{ margin:0, fontWeight:800, fontSize:'0.9rem', color:'var(--text-primary)' }}>{c.faculty_b_name}</p>
                                                <p style={{ margin:'4px 0 0', fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                                                    Saved offline · {bRecords.length} students ({bPresent}P / {bAbsent}A)
                                                </p>
                                                <button
                                                    onClick={() => handleResolve(c.id, 'faculty_b')}
                                                    disabled={isRes}
                                                    style={{ marginTop:14, width:'100%', padding:'10px', borderRadius:10, border:'none', background:isRes?'var(--border)':'linear-gradient(135deg,#B45309,#F59E0B)', color:'white', fontWeight:700, fontSize:'0.82rem', cursor:isRes?'not-allowed':'pointer', boxShadow:'0 3px 10px rgba(245,158,11,0.3)' }}
                                                >
                                                    {isRes ? 'Resolving…' : '📵 Accept Offline Submission'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </DashboardLayout>
    );
}
