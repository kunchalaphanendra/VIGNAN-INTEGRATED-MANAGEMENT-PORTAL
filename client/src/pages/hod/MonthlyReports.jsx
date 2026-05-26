import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import PrintButton from '../../components/PrintButton';
import api from '../../utils/api';

/* ─── Toast ──────────────────────────────────────────────────────────────── */
function Toast({ message, type = 'success', onDone }) {
    useEffect(() => { const t = setTimeout(onDone, 4500); return () => clearTimeout(t); }, [onDone]);
    return (
        <div style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
            background: type === 'success' ? '#128C7E' : '#DC2626',
            color: 'white', borderRadius: 12, padding: '14px 22px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: '0.875rem', fontWeight: 600, maxWidth: 460,
            animation: 'slideUp 0.3s ease',
        }}>
            {message}
        </div>
    );
}

/* ─── Build WhatsApp message with full student data ──────────────────────── */
function buildMessage(student, fullData, statsMap) {
    const att   = statsMap.attMap?.[student.id]?.percentage ?? null;
    const cgpa  = fullData?.cgpa  ?? statsMap.cgpaMap?.[student.id]  ?? null;
    const sgpa  = fullData?.sgpa  ?? statsMap.sgpaMap?.[student.id]  ?? null;
    const bl    = statsMap.backlogMap?.[student.id] ?? 0;
    const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

    let m = `Dear Parent,\n\n`;
    m += `📚 *Monthly Academic Report — ${month}*\n`;
    m += `👤 *${student.full_name}* (Roll: ${student.roll_number})\n`;
    m += `🏛 Year ${student.year} | Sem ${student.semester} | Section ${student.section || '—'}\n`;
    m += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Attendance
    m += `\n📊 *ATTENDANCE*\n`;
    if (att !== null) {
        const flag = att < 75 ? '🚨 BELOW 75% — DEFAULTER WARNING' : att < 85 ? '⚠️ Near Limit' : '✅ Good';
        m += `Overall: *${att}%*  ${flag}\n`;
    } else {
        m += `Overall: Not recorded yet\n`;
    }
    if (fullData?.attendance?.length > 0) {
        m += `\n*Subject-wise Attendance:*\n`;
        fullData.attendance.forEach(a => {
            const pct = Number(a.percentage ?? 0).toFixed(1);
            const icon = pct < 75 ? '🔴' : pct < 85 ? '🟡' : '🟢';
            m += `${icon} ${a.subject_name}: ${a.attended}/${a.total} (${pct}%)\n`;
        });
    }

    // Marks
    if (fullData?.marks?.length > 0) {
        m += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        m += `📝 *MARKS SUMMARY*\n`;
        const grouped = {};
        fullData.marks.forEach(mk => {
            if (!grouped[mk.subject_name]) grouped[mk.subject_name] = [];
            grouped[mk.subject_name].push(mk);
        });
        Object.entries(grouped).forEach(([sub, mkList]) => {
            m += `\n*${sub}*\n`;
            mkList.forEach(mk => {
                const pct = mk.max_marks > 0 ? ((mk.marks_obtained / mk.max_marks) * 100).toFixed(1) : '—';
                m += `  • ${mk.exam_label}: ${mk.marks_obtained}/${mk.max_marks} (${pct}%)\n`;
            });
        });
    }

    // Academics
    m += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    m += `🎓 *ACADEMICS*\n`;
    m += cgpa !== null ? `CGPA: *${cgpa}*\n` : `CGPA: Not available\n`;
    if (sgpa !== null) m += `SGPA (Current Sem): *${sgpa}*\n`;
    m += `Backlogs: *${bl > 0 ? bl + ' subject(s) — Contact HOD' : 'None ✅'}*\n`;
    if (fullData?.backlogs?.length > 0) {
        m += `\n*Backlog Details:*\n`;
        fullData.backlogs.forEach(b => { m += `  • ${b.subject_name} (Sem ${b.semester})\n`; });
    }

    m += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    m += `📞 For queries, contact HOD — Vignan College`;
    return m;
}

/* ─── Open WhatsApp redirect ─────────────────────────────────────────────── */
function openWhatsApp(phone, message) {
    if (!phone) return false;
    let p = phone.replace(/\D/g, '');
    if (p.length === 10) p = '91' + p;
    window.open(`https://wa.me/${p}?text=${encodeURIComponent(message)}`, '_blank');
    return true;
}

/* ─── Sequential Send-All Modal ──────────────────────────────────────────── */
function SendAllModal({ students, statsMap, onClose, fetchFull }) {
    const [idx, setIdx]         = useState(0);
    const [fullData, setFull]   = useState(null);
    const [loading, setLoading] = useState(false);
    const [sent, setSent]       = useState(0);

    const student = students[idx];

    useEffect(() => {
        if (!student) return;
        setFull(null);
        setLoading(true);
        fetchFull(student.id)
            .then(d => setFull(d))
            .finally(() => setLoading(false));
    }, [idx]);                          // eslint-disable-line

    const msg = student && !loading ? buildMessage(student, fullData, statsMap) : '';

    const handleSend = () => {
        const ok = openWhatsApp(student?.parent_phone, msg);
        if (ok) setSent(c => c + 1);
        else alert('No parent phone number registered for this student. Click Next to skip.');
    };

    const handleNext = () => {
        if (idx < students.length - 1) setIdx(i => i + 1);
        else onClose(sent);
    };

    const progress = Math.round((idx / students.length) * 100);

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.65)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
            <div style={{
                background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 580,
                maxHeight: '92vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 28px 64px rgba(0,0,0,0.4)', border: '1px solid var(--border)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>📨 Sending WhatsApp Reports</h2>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700,
                            background: 'var(--bg-secondary)', padding: '3px 10px', borderRadius: 20 }}>
                            {idx + 1} / {students.length}
                        </span>
                    </div>
                    <div style={{ height: 7, borderRadius: 4, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`,
                            background: 'linear-gradient(90deg, #25D366, #128C7E)',
                            borderRadius: 4, transition: 'width 0.35s ease' }} />
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        ✅ {sent} sent so far — click "Open WhatsApp" then "Next" for each parent
                    </p>
                </div>

                {/* Student bar */}
                {student && (
                    <div style={{
                        padding: '14px 24px', borderBottom: '1px solid var(--border)',
                        background: 'rgba(37,211,102,0.06)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <div>
                            <p style={{ fontWeight: 800, fontSize: '1rem', margin: 0 }}>{student.full_name}</p>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                                Roll: {student.roll_number} • Y{student.year} Sec {student.section}
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: 0 }}>Parent Phone</p>
                            <p style={{ fontWeight: 700, fontSize: '0.9rem', margin: '3px 0 0',
                                fontFamily: 'monospace', color: student.parent_phone ? '#128C7E' : '#DC2626' }}>
                                {student.parent_phone || 'Not registered'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Message preview */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)',
                        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                        Message Preview
                    </p>
                    {loading ? (
                        <div style={{ padding: 32, textAlign: 'center' }}><LoadingSpinner /></div>
                    ) : (
                        <pre style={{
                            fontSize: '0.77rem', lineHeight: 1.65, whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word', background: 'var(--bg-secondary)',
                            borderRadius: 10, padding: '14px 16px', color: 'var(--text-primary)',
                            fontFamily: 'inherit', margin: 0, maxHeight: 320, overflowY: 'auto',
                        }}>{msg}</pre>
                    )}
                </div>

                {/* Footer buttons */}
                <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)',
                    display: 'flex', gap: 10 }}>
                    <button onClick={() => onClose(sent)} style={{
                        padding: '9px 14px', borderRadius: 9, border: '1.5px solid var(--border)',
                        background: 'transparent', color: 'var(--text-secondary)',
                        fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                    }}>Stop</button>

                    <button onClick={handleSend} disabled={loading || !student?.parent_phone} style={{
                        flex: 1, padding: '10px 16px', borderRadius: 9, border: 'none',
                        background: loading || !student?.parent_phone
                            ? 'var(--border)'
                            : 'linear-gradient(135deg, #25D366, #128C7E)',
                        color: 'white', fontWeight: 700, fontSize: '0.875rem',
                        cursor: loading || !student?.parent_phone ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    }}>
                        📱 Open WhatsApp
                    </button>

                    <button onClick={handleNext} style={{
                        padding: '10px 22px', borderRadius: 9,
                        border: '1.5px solid var(--border)', background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.875rem',
                        cursor: 'pointer',
                    }}>
                        {idx < students.length - 1 ? 'Next →' : 'Done ✓'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function HodMonthlyReports() {
    const [students,    setStudents]  = useState([]);
    const [statsMap,    setStatsMap]  = useState({ attMap: {}, cgpaMap: {}, sgpaMap: {}, backlogMap: {} });
    const [loading,     setLoading]   = useState(true);
    const [toasts,      setToasts]    = useState([]);
    const [filterYear,  setFilterYear]    = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [search,      setSearch]    = useState('');
    const [sendingId,   setSendingId] = useState(null);
    const [showSendAll, setShowSendAll] = useState(false);
    const [sortCol,     setSortCol]   = useState('roll_number');
    const [sortDir,     setSortDir]   = useState('asc');

    // Client-side filtered list (search by roll no or name)
    const displayed = students.filter(s => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return (
            (s.roll_number || '').toLowerCase().includes(q) ||
            (s.full_name   || '').toLowerCase().includes(q)
        );
    });

    // Sort displayed list
    const sorted = [...displayed].sort((a, b) => {
        let av, bv;
        switch (sortCol) {
            case 'roll_number': av = a.roll_number || ''; bv = b.roll_number || ''; break;
            case 'full_name':   av = a.full_name   || ''; bv = b.full_name   || ''; break;
            case 'year':        av = Number(a.year)  || 0; bv = Number(b.year)  || 0; break;
            case 'section':     av = a.section || ''; bv = b.section || ''; break;
            case 'attendance':  av = statsMap.attMap?.[a.id]?.percentage ?? -1; bv = statsMap.attMap?.[b.id]?.percentage ?? -1; break;
            case 'cgpa':        av = statsMap.cgpaMap?.[a.id] ?? -1; bv = statsMap.cgpaMap?.[b.id] ?? -1; break;
            case 'backlogs':    av = statsMap.backlogMap?.[a.id] ?? 0; bv = statsMap.backlogMap?.[b.id] ?? 0; break;
            case 'parent_phone': av = a.parent_phone ? 1 : 0; bv = b.parent_phone ? 1 : 0; break;
            default: av = ''; bv = '';
        }
        if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        return sortDir === 'asc' ? av - bv : bv - av;
    });

    const toggleSort = (col) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('asc'); }
    };

    const SortTh = ({ col, children }) => {
        const active = sortCol === col;
        return (
            <th onClick={() => toggleSort(col)} style={{
                cursor: 'pointer', userSelect: 'none',
                color: active ? '#128C7E' : undefined,
                whiteSpace: 'nowrap',
            }}>
                {children}
                <span style={{ marginLeft: 5, opacity: active ? 1 : 0.3, fontSize: '0.7rem' }}>
                    {active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
            </th>
        );
    };

    const addToast = (msg, type = 'success') => {
        const id = Date.now();
        setToasts(p => [...p, { id, msg, type }]);
    };

    const fetchData = useCallback(async (yr, sec) => {
        setLoading(true);
        try {
            const params = {};
            if (yr)  params.year    = yr;
            if (sec) params.section = sec;
            const [studRes, statsRes] = await Promise.all([
                api.get('/hod/students', { params }),
                api.get('/hod/students/stats', { params }),
            ]);
            setStudents(studRes.data.students || []);
            setStatsMap(statsRes.data || { attMap: {}, cgpaMap: {}, sgpaMap: {}, backlogMap: {} });
        } catch {
            addToast('Failed to load data', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(filterYear, filterSection); }, [filterYear, filterSection, fetchData]);

    const fetchFull = async (id) => {
        try { return (await api.get(`/hod/students/${id}/full`)).data; }
        catch { return null; }
    };

    const handleSendOne = async (student) => {
        setSendingId(student.id);
        try {
            const full = await fetchFull(student.id);
            const msg  = buildMessage(student, full, statsMap);
            const ok   = openWhatsApp(student.parent_phone, msg);
            if (!ok) addToast(`No parent phone for ${student.full_name}`, 'error');
            else     addToast(`WhatsApp opened for parent of ${student.full_name} ✅`);
        } finally {
            setSendingId(null);
        }
    };

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <style>{`@keyframes slideUp { from { transform:translateY(20px);opacity:0 } to { transform:translateY(0);opacity:1 } }`}</style>
            {toasts.map(t => <Toast key={t.id} message={t.msg} type={t.type} onDone={() => setToasts(p => p.filter(x => x.id !== t.id))} />)}

            {showSendAll && (
                <SendAllModal
                    students={displayed}
                    statsMap={statsMap}
                    fetchFull={fetchFull}
                    onClose={(cnt) => {
                        setShowSendAll(false);
                        if (cnt > 0) addToast(`📱 WhatsApp opened for ${cnt} parent(s)`);
                    }}
                />
            )}

            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)',
                        letterSpacing: '-0.02em', margin: 0 }}>Monthly Reports</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        Send academic performance reports to parents via WhatsApp
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <PrintButton label="Download PDF" />
                    <button
                        onClick={() => displayed.length > 0 && setShowSendAll(true)}
                        disabled={displayed.length === 0}
                        style={{
                            padding: '11px 22px', borderRadius: 10, border: 'none',
                            background: displayed.length === 0
                                ? 'var(--border)'
                                : 'linear-gradient(135deg, #25D366, #128C7E)',
                            color: 'white', fontWeight: 700, fontSize: '0.875rem',
                            cursor: displayed.length === 0 ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                            boxShadow: displayed.length > 0 ? '0 4px 14px rgba(37,211,102,0.35)' : 'none',
                            transition: 'all 0.2s',
                        }}
                    >
                        📨 Send Report to All {displayed.length} Parents
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Search box */}
                <div style={{ position: 'relative', flex: '2 1 220px', minWidth: 180 }}>
                    <span style={{
                        position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
                        fontSize: '0.9rem', color: 'var(--text-tertiary)', pointerEvents: 'none',
                    }}>🔍</span>
                    <input
                        className="form-input"
                        style={{ paddingLeft: 32, width: '100%' }}
                        placeholder="Search roll no or name…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{
                            position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-tertiary)', fontSize: '0.85rem', padding: 2,
                        }}>✕</button>
                    )}
                </div>

                <select className="form-input" style={{ flex: '1 1 140px', maxWidth: 180 }}
                    value={filterYear} onChange={e => { setFilterYear(e.target.value); setFilterSection(''); }}>
                    <option value="">All Years</option>
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
                <select className="form-input" style={{ flex: '1 1 140px', maxWidth: 180 }}
                    value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                    <option value="">All Sections</option>
                    {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>Section {s}</option>)}
                </select>

                {(filterYear || filterSection || search) && (
                    <button onClick={() => { setFilterYear(''); setFilterSection(''); setSearch(''); }}
                        style={{ padding: '9px 14px', borderRadius: 9, border: '1.5px solid var(--border)',
                            background: 'transparent', color: 'var(--text-secondary)',
                            fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ✕ Clear All
                    </button>
                )}

                <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {displayed.length} of {students.length} student{students.length !== 1 ? 's' : ''}
                    {filterYear ? ` · Y${filterYear}` : ''}
                    {filterSection ? ` · Sec ${filterSection}` : ''}
                </span>
            </div>

            {/* Info banner */}
            <div style={{
                borderRadius: 12, padding: '12px 18px', marginBottom: 20,
                background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)',
                fontSize: '0.82rem', color: '#0a7a5a', fontWeight: 500,
            }}>
                📋 Reports include: Attendance % (overall + subject-wise), Subject Marks (Mid-1, Mid-2, Assignment, Final), CGPA/SGPA, Backlog list, Defaulter warning — sent via <strong>WhatsApp</strong> to parent's registered phone.
            </div>

            {/* Table */}
            <div style={{ borderRadius: 14, overflowX: 'auto', background: 'var(--bg-card)',
                border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', WebkitOverflowScrolling: 'touch' }}>
                <table className="data-table" style={{ minWidth: 700 }}>
                    <thead>
                        <tr>
                            <SortTh col="roll_number">Roll No</SortTh>
                            <SortTh col="full_name">Name</SortTh>
                            <SortTh col="year">Year / Sem</SortTh>
                            <SortTh col="section">Section</SortTh>
                            <SortTh col="attendance">Attendance</SortTh>
                            <SortTh col="cgpa">CGPA</SortTh>
                            <SortTh col="backlogs">Backlogs</SortTh>
                            <SortTh col="parent_phone">Parent Phone</SortTh>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(s => {
                            const att  = statsMap.attMap?.[s.id]?.percentage ?? null;
                            const cgpa = statsMap.cgpaMap?.[s.id] ?? null;
                            const bl   = statsMap.backlogMap?.[s.id] ?? 0;
                            const busy = sendingId === s.id;
                            return (
                                <tr key={s.id}>
                                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.roll_number}</span></td>
                                    <td><span style={{ fontWeight: 500 }}>{s.full_name}</span></td>
                                    <td style={{ color: 'var(--text-secondary)' }}>Y{s.year} · S{s.semester}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{s.section || '—'}</td>
                                    <td>
                                        {att !== null
                                            ? <span style={{ fontWeight: 700, color: att < 75 ? '#DC2626' : att < 85 ? '#F59E0B' : '#16A34A' }}>
                                                {att}% {att < 75 ? '⚠' : ''}
                                              </span>
                                            : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>}
                                    </td>
                                    <td>
                                        {cgpa !== null
                                            ? <span style={{ fontWeight: 700 }}>{cgpa}</span>
                                            : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>}
                                    </td>
                                    <td>
                                        {bl > 0
                                            ? <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem',
                                                fontWeight: 700, background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>⚠ {bl}</span>
                                            : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>}
                                    </td>
                                    <td>
                                        {s.parent_phone
                                            ? <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#128C7E', fontWeight: 600 }}>{s.parent_phone}</span>
                                            : <span style={{ color: '#DC2626', fontSize: '0.75rem', fontWeight: 600 }}>Not registered</span>}
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => !busy && handleSendOne(s)}
                                            disabled={busy}
                                            style={{
                                                padding: '6px 14px', borderRadius: 8,
                                                border: '1.5px solid rgba(37,211,102,0.4)',
                                                background: busy ? 'var(--border)' : 'rgba(37,211,102,0.1)',
                                                color: busy ? 'var(--text-tertiary)' : '#128C7E',
                                                fontSize: '0.78rem', fontWeight: 700,
                                                cursor: busy ? 'not-allowed' : 'pointer',
                                                display: 'inline-flex', alignItems: 'center', gap: 5,
                                                transition: 'all 0.15s',
                                                whiteSpace: 'nowrap',
                                            }}
                                            onMouseEnter={e => { if (!busy) { e.currentTarget.style.background='#25D366'; e.currentTarget.style.color='white'; } }}
                                            onMouseLeave={e => { if (!busy) { e.currentTarget.style.background='rgba(37,211,102,0.1)'; e.currentTarget.style.color='#128C7E'; } }}
                                        >
                                            {busy ? '⏳ Loading…' : '📱 Send Report'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {students.length === 0 && (
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                                    No students found for the selected filter
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </DashboardLayout>
    );
}
