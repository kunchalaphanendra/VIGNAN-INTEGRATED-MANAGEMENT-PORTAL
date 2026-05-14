import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onDone }) {
    useEffect(() => { const t = setTimeout(onDone, 4500); return () => clearTimeout(t); }, [onDone]);
    const bg = type === 'success' ? '#16A34A' : type === 'error' ? '#DC2626' : '#1565C0';
    return (
        <div style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 9999, background: bg, color: 'white',
            borderRadius: 12, padding: '14px 22px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            fontSize: '0.875rem', fontWeight: 600, maxWidth: 420, animation: 'slideUp 0.3s ease',
        }}>{message}</div>
    );
}

// ─── Grade from percentage ────────────────────────────────────────────────────
function gradeFor(pct) {
    if (pct >= 90) return { label: 'O', color: '#16A34A' };
    if (pct >= 80) return { label: 'A+', color: '#16A34A' };
    if (pct >= 70) return { label: 'A', color: '#16A34A' };
    if (pct >= 60) return { label: 'B+', color: '#F59E0B' };
    if (pct >= 50) return { label: 'B', color: '#F59E0B' };
    if (pct >= 40) return { label: 'C', color: '#F59E0B' };
    return { label: 'F', color: '#DC2626' };
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color = 'var(--primary)' }) {
    return (
        <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
            padding: '18px 22px', display: 'flex', alignItems: 'flex-start', gap: 14,
        }}>
            <div style={{
                width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0,
                background: `${color}18`,
            }}>{icon}</div>
            <div>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</p>
                {sub && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</p>}
            </div>
        </div>
    );
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function GradeBar({ pct, color }) {
    return (
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Detail Modal — per-subject, per-exam drill-down
// ═══════════════════════════════════════════════════════════════════════════
function DetailModal({ subjectId, subjectName, examLabel, examType, onClose }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const r = await api.get(`/hod/marks/detail?subject_id=${subjectId}&exam_label=${encodeURIComponent(examLabel)}`);
                setRows(r.data.marks || []);
            } catch { setRows([]); }
            finally { setLoading(false); }
        })();
    }, [subjectId, examLabel]);

    const passFail = rows.reduce((a, m) => {
        const pct = (m.marks_obtained / m.max_marks) * 100;
        return pct >= 40 ? { ...a, pass: a.pass + 1 } : { ...a, fail: a.fail + 1 };
    }, { pass: 0, fail: 0 });

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 760, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.35)', border: '1px solid var(--border)' }}>
                {/* Header */}
                <div style={{ padding: '22px 26px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{subjectName}</h2>
                        <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span style={{
                                padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize', marginRight: 8,
                                background: examType === 'internal' ? 'rgba(21,101,192,0.1)' : examType === 'external' ? 'rgba(220,38,38,0.1)' : 'rgba(245,158,11,0.1)',
                                color: examType === 'internal' ? '#1565C0' : examType === 'external' ? '#DC2626' : '#B45309',
                            }}>{examType}</span>
                            {examLabel}
                        </p>
                    </div>
                    <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                        ✕ Close
                    </button>
                </div>

                {loading ? (
                    <div style={{ padding: 48, textAlign: 'center' }}><LoadingSpinner /></div>
                ) : (
                    <>
                        {/* Quick stats row */}
                        {rows.length > 0 && (
                            <div style={{ padding: '14px 26px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    <strong style={{ color: 'var(--text-primary)' }}>{rows.length}</strong> students •
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#16A34A', fontWeight: 600 }}>✓ {passFail.pass} passed</span>
                                <span style={{ fontSize: '0.8rem', color: '#DC2626', fontWeight: 600 }}>✗ {passFail.fail} failed</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Pass rate: <strong style={{ color: rows.length > 0 ? (passFail.pass / rows.length * 100 >= 60 ? '#16A34A' : '#DC2626') : 'var(--text-primary)' }}>
                                        {rows.length > 0 ? (passFail.pass / rows.length * 100).toFixed(1) : 0}%
                                    </strong>
                                </span>
                            </div>
                        )}

                        {/* Table */}
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {rows.length === 0 ? (
                                <div style={{ padding: 40, textAlign: 'center' }}>
                                    <p style={{ color: 'var(--text-secondary)' }}>No student records found.</p>
                                </div>
                            ) : (
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Roll No</th>
                                            <th>Student Name</th>
                                            <th>Marks</th>
                                            <th>%</th>
                                            <th>Grade</th>
                                            <th>Performance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map(m => {
                                            const pct = m.max_marks > 0 ? (m.marks_obtained / m.max_marks) * 100 : 0;
                                            const g = gradeFor(pct);
                                            return (
                                                <tr key={m.id}>
                                                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem' }}>{m.roll_number}</span></td>
                                                    <td style={{ fontWeight: 500 }}>{m.full_name}</td>
                                                    <td><span style={{ fontWeight: 700 }}>{m.marks_obtained}/{m.max_marks}</span></td>
                                                    <td><span style={{ color: g.color, fontWeight: 600 }}>{pct.toFixed(1)}%</span></td>
                                                    <td>
                                                        <span style={{
                                                            padding: '3px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                                                            background: g.color === '#DC2626' ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.1)',
                                                            color: g.color,
                                                        }}>{g.label}</span>
                                                    </td>
                                                    <td style={{ minWidth: 120 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <GradeBar pct={pct} color={g.color} />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
export default function HodMarks() {
    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toasts, setToasts] = useState([]);
    const [modal, setModal] = useState(null); // { subjectId, subjectName, examLabel, examType }
    const [filterType, setFilterType] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const [filterYear, setFilterYear] = useState('');
    const [filterSection, setFilterSection] = useState('');

    const addToast = (msg, type = 'success') => { const id = Date.now(); setToasts(p => [...p, { id, msg, type }]); };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get('/hod/marks/summary');
            setSummary(r.data.summary || []);
        } catch {
            addToast('Failed to load marks summary', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);



    // Unique filter options from data
    const uniqueYears    = [...new Set(summary.map(r => r.year).filter(Boolean))].sort();
    const uniqueSections = [...new Set(summary.map(r => r.section).filter(Boolean))].sort();

    // Stats (unfiltered)
    const totalEntries = summary.reduce((a, r) => a + Number(r.entries), 0);
    const avgMarks = summary.length > 0
        ? (summary.reduce((a, r) => a + (Number(r.avg_marks) / Number(r.max_marks)) * 100, 0) / summary.length).toFixed(1)
        : '—';
    const failCount = summary.filter(r => (Number(r.avg_marks) / Number(r.max_marks)) * 100 < 40).length;

    // Filter
    const filtered = summary.filter(row => {
        const matchType    = !filterType    || row.exam_type === filterType;
        const matchYear    = !filterYear    || String(row.year)    === String(filterYear);
        const matchSection = !filterSection || String(row.section) === String(filterSection);
        const matchSearch  = !searchQuery   || row.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) || row.code?.toLowerCase().includes(searchQuery.toLowerCase()) || row.exam_label?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchType && matchYear && matchSection && matchSearch;
    });

    // Group filtered by subject + class (year+section)
    const filteredSubjectMap = {};
    filtered.forEach(row => {
        const key = `${row.subject_id}||${row.year}||${row.section}`;
        if (!filteredSubjectMap[key]) filteredSubjectMap[key] = { subject_name: row.subject_name, code: row.code, subject_id: row.subject_id, year: row.year, section: row.section, exams: [] };
        filteredSubjectMap[key].exams.push(row);
    });
    const filteredSubjects = Object.values(filteredSubjectMap);
    const subjectCount = [...new Set(summary.map(r => r.subject_id))].length;


    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

            {toasts.map(t => <Toast key={t.id} message={t.msg} type={t.type} onDone={() => setToasts(p => p.filter(x => x.id !== t.id))} />)}
            {modal && <DetailModal {...modal} onClose={() => setModal(null)} />}

            {/* Page Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Marks Management</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Review faculty-entered marks across all subjects in your department
                </p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
                <StatCard icon="📚" label="Subjects with Marks" value={subjectCount} sub="across all exams" color="#1565C0" />
                <StatCard icon="📊" label="Total Entries" value={totalEntries} sub="student mark records" color="#7C3AED" />
                <StatCard icon="📈" label="Avg Class Score" value={`${avgMarks}%`} sub="across all exams" color="#16A34A" />
                <StatCard icon="⚠" label="Below 40% Exams" value={failCount} sub="need attention" color="#DC2626" />
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    className="form-input"
                    style={{ flex: '2 1 200px', minWidth: 180 }}
                    placeholder="🔍 Search subject, code, or exam…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                <select className="form-input" style={{ flex: '1 1 140px' }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                    <option value="">All Years</option>
                    {uniqueYears.map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
                <select className="form-input" style={{ flex: '1 1 140px' }} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                    <option value="">All Sections</option>
                    {uniqueSections.map(s => <option key={s} value={s}>Section {s}</option>)}
                </select>
                <select className="form-input" style={{ flex: '1 1 150px' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="">All Exam Types</option>
                    <option value="internal">Internal</option>
                    <option value="external">External</option>
                    <option value="assignment">Assignment</option>
                </select>
                {(filterYear || filterSection || filterType || searchQuery) && (
                    <button onClick={() => { setFilterYear(''); setFilterSection(''); setFilterType(''); setSearchQuery(''); }}
                        style={{ padding: '9px 14px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ✕ Clear
                    </button>
                )}
                <button onClick={load} style={{ padding: '9px 18px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
                    🔄 Refresh
                </button>
            </div>

            {/* Subject Cards */}
            {filteredSubjects.length === 0 ? (
                <div style={{ padding: 56, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '2rem', marginBottom: 10 }}>📋</p>
                    <p style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '1rem' }}>No marks data available</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginTop: 4 }}>Faculty must enter marks first from the Marks portal.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {filteredSubjects.map(sub => {
                        const overallAvg = sub.exams.length > 0
                            ? (sub.exams.reduce((a, e) => a + (Number(e.avg_marks) / Number(e.max_marks)) * 100, 0) / sub.exams.length).toFixed(1)
                            : 0;
                        const overallPctColor = overallAvg >= 60 ? '#16A34A' : overallAvg >= 40 ? '#F59E0B' : '#DC2626';

                        return (
                            <div key={sub.subject_name} style={{
                                background: 'var(--bg-card)', borderRadius: 16, border: `1px solid var(--border)`,
                                overflow: 'hidden', transition: 'box-shadow 0.2s',
                            }}>
                                {/* Subject Header */}
                                <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(21,101,192,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>📖</div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{sub.subject_name}</h3>
                                                {(sub.year || sub.section) && (
                                                    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: '#6366f1', letterSpacing: '0.03em' }}>
                                                        {sub.year ? `Year ${sub.year}` : ''}{sub.year && sub.section ? ' · ' : ''}{sub.section ? `Sec ${sub.section}` : ''}
                                                    </span>
                                                )}
                                            </div>
                                            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                Code: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{sub.code}</span>
                                                &ensp;·&ensp; {sub.exams.length} exam{sub.exams.length !== 1 ? 's' : ''}
                                                &ensp;·&ensp; Overall avg: <span style={{ color: overallPctColor, fontWeight: 700 }}>{overallAvg}%</span>
                                            </p>
                                        </div>
                                    </div>

                                </div>

                                {/* Exam Rows */}
                                <div>
                                    {sub.exams.map((exam, i) => {
                                        const avgPct = exam.max_marks > 0 ? (exam.avg_marks / exam.max_marks) * 100 : 0;
                                        const g = gradeFor(avgPct);
                                        return (
                                            <div key={i} style={{
                                                padding: '14px 22px',
                                                borderBottom: i < sub.exams.length - 1 ? '1px solid var(--border)' : 'none',
                                                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                                                background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)',
                                            }}>
                                                {/* Exam type badge */}
                                                <span style={{
                                                    padding: '3px 10px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize', flexShrink: 0,
                                                    background: exam.exam_type === 'internal' ? 'rgba(21,101,192,0.1)' : exam.exam_type === 'external' ? 'rgba(220,38,38,0.1)' : 'rgba(245,158,11,0.1)',
                                                    color: exam.exam_type === 'internal' ? '#1565C0' : exam.exam_type === 'external' ? '#DC2626' : '#B45309',
                                                }}>{exam.exam_type}</span>

                                                {/* Label */}
                                                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', minWidth: 80 }}>{exam.exam_label}</span>

                                                {/* Avg score */}
                                                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', minWidth: 120 }}>
                                                    Avg: <strong style={{ color: g.color }}>{Number(exam.avg_marks).toFixed(1)}/{exam.max_marks}</strong>
                                                </span>

                                                {/* Pct & grade */}
                                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: g.color, minWidth: 70 }}>{avgPct.toFixed(1)}%</span>
                                                <span style={{
                                                    padding: '3px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700,
                                                    background: g.color === '#DC2626' ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.1)',
                                                    color: g.color, minWidth: 44, textAlign: 'center',
                                                }}>{g.label}</span>

                                                {/* Progress bar */}
                                                <div style={{ flex: 1, minWidth: 80 }}>
                                                    <GradeBar pct={avgPct} color={g.color} />
                                                </div>

                                                {/* Entries count */}
                                                <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', minWidth: 80 }}>
                                                    {exam.entries} student{exam.entries !== 1 ? 's' : ''}
                                                </span>

                                                {/* View details */}
                                                <button
                                                    onClick={() => setModal({ subjectId: sub.subject_id, subjectName: sub.subject_name, examLabel: exam.exam_label, examType: exam.exam_type })}
                                                    style={{
                                                        padding: '5px 14px', borderRadius: 8, border: '1.5px solid var(--primary)',
                                                        background: 'rgba(21,101,192,0.07)', color: 'var(--primary)',
                                                        fontWeight: 700, fontSize: '0.73rem', cursor: 'pointer', flexShrink: 0,
                                                    }}
                                                >
                                                    👁 View Details
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </DashboardLayout>
    );
}
