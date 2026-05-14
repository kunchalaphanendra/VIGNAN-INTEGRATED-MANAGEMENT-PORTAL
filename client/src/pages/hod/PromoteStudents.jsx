import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import Modal from '../../components/Modal';
import api from '../../utils/api';

/* ── helpers ──────────────────────────────────────────────────── */
const SEM_OPTIONS = [
    { value: '1', label: 'Sem 1  →  Sem 2  (Year 1)' },
    { value: '3', label: 'Sem 3  →  Sem 4  (Year 2)' },
    { value: '5', label: 'Sem 5  →  Sem 6  (Year 3)' },
    { value: '7', label: 'Sem 7  →  Sem 8  (Year 4)' },
];
const YEAR_OPTIONS = [
    { value: '1', label: 'Year 1  →  Year 2  (Sem 1/2 → Sem 3)' },
    { value: '2', label: 'Year 2  →  Year 3  (Sem 3/4 → Sem 5)' },
    { value: '3', label: 'Year 3  →  Year 4  (Sem 5/6 → Sem 7)' },
    { value: '4', label: 'Year 4  →  Graduated 🎓' },
];

function AttBadge({ v }) {
    if (v == null) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
    const c = v >= 75 ? '#15803D' : v >= 60 ? '#D97706' : '#DC2626';
    return <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, color: c, background: c + '18' }}>{v}%</span>;
}

function StudentTable({ students, selected, onToggle, onToggleAll, mode }) {
    const allSelected = selected.size === students.length && students.length > 0;
    return (
        <div style={{ borderRadius: 12, overflowX: 'auto', border: '1px solid var(--border)', background: 'var(--bg-card)', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 14px', width: 36 }}>
                            <div onClick={onToggleAll} style={{
                                width: 18, height: 18, borderRadius: 5, cursor: 'pointer',
                                border: `2px solid ${allSelected ? '#2E7D32' : 'var(--border)'}`,
                                background: allSelected ? '#2E7D32' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>{allSelected && <span style={{ color: 'white', fontSize: '0.6rem', fontWeight: 900 }}>✓</span>}</div>
                        </th>
                        {['Roll No', 'Name', 'Sec', 'Current', 'Will Become', 'Attendance', 'CGPA', 'Backlogs'].map(h => (
                            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {students.map((s, i) => {
                        const checked = selected.has(s.id);
                        const curYear = Number(s.year), curSem = Number(s.semester);
                        let willBecome;
                        if (!checked) {
                            willBecome = <span style={{ fontSize: '0.72rem', color: '#B45309', background: '#FEF3C720', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>⏸ No change</span>;
                        } else if (mode === 'semester') {
                            willBecome = <span style={{ fontSize: '0.72rem', color: '#1D4ED8', background: '#DBEAFE', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>Year {curYear} / Sem {curSem + 1}</span>;
                        } else if (curYear >= 4) {
                            willBecome = <span style={{ fontSize: '0.72rem', color: '#4338CA', background: '#EDE9FE', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>🎓 Graduated</span>;
                        } else {
                            const ny = curYear + 1;
                            willBecome = <span style={{ fontSize: '0.72rem', color: '#15803D', background: '#DCFCE7', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>Year {ny} / Sem {ny * 2 - 1}</span>;
                        }
                        return (
                            <tr key={s.id} onClick={() => onToggle(s.id)} style={{
                                borderBottom: i < students.length - 1 ? '1px solid var(--border)' : 'none',
                                cursor: 'pointer', opacity: checked ? 1 : 0.55,
                                background: checked ? 'transparent' : 'rgba(217,119,6,0.03)',
                                transition: 'all 0.12s',
                            }}>
                                <td style={{ padding: '10px 14px' }}>
                                    <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? '#2E7D32' : 'var(--border)'}`, background: checked ? '#2E7D32' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {checked && <span style={{ color: 'white', fontSize: '0.6rem', fontWeight: 900 }}>✓</span>}
                                    </div>
                                </td>
                                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem' }}>{s.roll_number}</td>
                                <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: '0.85rem' }}>{s.full_name}</td>
                                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{s.section || '—'}</td>
                                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Y{s.year}/S{s.semester}</td>
                                <td style={{ padding: '10px 12px' }}>{willBecome}</td>
                                <td style={{ padding: '10px 12px' }}><AttBadge v={s.attendance} /></td>
                                <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: '0.82rem' }}>{s.cgpa ?? '—'}</td>
                                <td style={{ padding: '10px 12px', fontSize: '0.82rem', color: s.backlogs > 0 ? '#DC2626' : '#15803D', fontWeight: 600 }}>{s.backlogs || 'None'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/* ── Main ─────────────────────────────────────────────────────── */
export default function PromoteStudents() {
    const [tab, setTab]               = useState('year');      // 'year' | 'semester'
    const [yearFilter, setYearFilter] = useState('');
    const [semFilter, setSemFilter]   = useState('');
    const [secFilter, setSecFilter]   = useState('');
    const [students, setStudents]     = useState([]);
    const [selected, setSelected]     = useState(new Set());
    const [loading, setLoading]       = useState(false);
    const [promoting, setPromoting]   = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [result, setResult]         = useState(null);
    const [search, setSearch]         = useState('');

    const sections = useMemo(() => [...new Set(students.map(s => s.section).filter(Boolean))].sort(), [students]);

    const reset = () => { setStudents([]); setSelected(new Set()); setResult(null); setSearch(''); };

    const load = async () => {
        if (tab === 'year' && !yearFilter) return alert('Select a year first');
        if (tab === 'semester' && !semFilter) return alert('Select a semester first');
        setLoading(true); reset();
        try {
            const p = new URLSearchParams();
            if (tab === 'year')     { p.append('year', yearFilter); }
            if (tab === 'semester') { p.append('semester', semFilter); }
            if (secFilter) p.append('section', secFilter);
            const r = await api.get(`/hod/students/promotable?${p}`);
            const list = r.data.students || [];
            setStudents(list);
            setSelected(new Set(list.map(s => s.id)));
        } catch (err) { alert(err.response?.data?.error || 'Failed to load'); }
        finally { setLoading(false); }
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? students.filter(s => s.full_name.toLowerCase().includes(q) || s.roll_number.toLowerCase().includes(q)) : students;
    }, [students, search]);

    const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(s => s.id)));
    const toggleOne = id => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); };

    const doPromote = async () => {
        setPromoting(true);
        try {
            const r = await api.post('/hod/students/promote', { student_ids: [...selected], mode: tab });
            setResult(r.data);
            setShowConfirm(false);
            await load();
        } catch (err) { alert(err.response?.data?.error || 'Promotion failed'); }
        finally { setPromoting(false); }
    };

    const skipped = students.filter(s => !selected.has(s.id));
    const willGrad = tab === 'year' ? students.filter(s => selected.has(s.id) && Number(s.year) >= 4) : [];
    const willPromote = tab === 'year' ? students.filter(s => selected.has(s.id) && Number(s.year) < 4) : [];

    const TAB_BTN = (t, label, emoji) => (
        <button onClick={() => { setTab(t); reset(); setYearFilter(''); setSemFilter(''); setSecFilter(''); }} style={{
            padding: '10px 24px', borderRadius: 10, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
            border: `2px solid ${tab === t ? '#2E7D32' : 'var(--border)'}`,
            background: tab === t ? '#2E7D32' : 'var(--bg-card)',
            color: tab === t ? 'white' : 'var(--text-secondary)',
            transition: 'all 0.15s',
        }}>{emoji} {label}</button>
    );

    return (
        <DashboardLayout>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>🎓 Student Progression</h1>
                <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', margin: 0 }}>Advance semester within the same year, or promote to the next year.</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
                {TAB_BTN('year', 'Promote Year', '📅')}
                {TAB_BTN('semester', 'Advance Semester', '📖')}
            </div>

            {/* Info banner per tab */}
            <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: '0.82rem', lineHeight: 1.6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                {tab === 'year'
                    ? <><strong>Promote Year:</strong> Moves selected students to the next academic year. Year auto-sets to the first semester of the new year (e.g. Year 2 → Sem 3). Year 4 students will be <strong>graduated</strong> (account deactivated).</>
                    : <><strong>Advance Semester:</strong> Moves selected students from the current semester to the next (Sem+1). The academic year does <strong>not</strong> change. Use this at mid-year (e.g. Sem 1 → Sem 2).</>
                }
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', padding: '16px 20px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: 20 }}>
                {tab === 'year' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Year *</label>
                        <select className="form-input" value={yearFilter} onChange={e => { setYearFilter(e.target.value); reset(); }} style={{ minWidth: 260 }}>
                            <option value="">Choose year to promote…</option>
                            {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Semester *</label>
                        <select className="form-input" value={semFilter} onChange={e => { setSemFilter(e.target.value); reset(); }} style={{ minWidth: 260 }}>
                            <option value="">Choose semester to advance…</option>
                            {SEM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Section</label>
                    <select className="form-input" value={secFilter} onChange={e => setSecFilter(e.target.value)} style={{ minWidth: 140 }}>
                        <option value="">All Sections</option>
                        {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
                    </select>
                </div>
                <button onClick={load} disabled={loading} className="btn btn-hod" style={{ alignSelf: 'flex-end' }}>
                    {loading ? 'Loading…' : 'Load Students'}
                </button>
            </div>

            {/* Result banner */}
            {result && (
                <div style={{ padding: '14px 20px', borderRadius: 10, marginBottom: 18, background: 'rgba(22,163,74,0.1)', border: '1.5px solid rgba(22,163,74,0.3)', display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: '1.3rem' }}>✅</span>
                    <div>
                        <p style={{ margin: 0, fontWeight: 700, color: '#15803D', fontSize: '0.9rem' }}>Done!</p>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#166534' }}>{result.message}</p>
                    </div>
                </div>
            )}

            {loading && <div style={{ textAlign: 'center', padding: 48 }}><LoadingSpinner /></div>}

            {/* Table */}
            {!loading && filtered.length > 0 && (
                <>
                    {/* Toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button onClick={toggleAll} style={{ padding: '6px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' }}>
                                {selected.size === filtered.length ? '☐ Deselect All' : '☑ Select All'}
                            </button>
                            <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(46,125,50,0.12)', color: '#2E7D32' }}>✓ {selected.size} selected</span>
                            {skipped.length > 0 && <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(217,119,6,0.12)', color: '#D97706' }}>⏸ {skipped.length} skipped</span>}
                            {willGrad.length > 0 && <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: '#4338CA' }}>🎓 {willGrad.length} graduating</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <input className="form-input" style={{ paddingTop: 7, paddingBottom: 7, width: 200, fontSize: '0.82rem' }} placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} />
                            <button onClick={() => setShowConfirm(true)} disabled={selected.size === 0} className="btn btn-hod" style={{ opacity: selected.size === 0 ? 0.5 : 1 }}>
                                {tab === 'year' ? '🎓' : '📖'} Apply to {selected.size} students
                            </button>
                        </div>
                    </div>
                    <StudentTable students={filtered} selected={selected} onToggle={toggleOne} onToggleAll={toggleAll} mode={tab} />
                </>
            )}

            {/* Empty / initial state */}
            {!loading && !filtered.length && (yearFilter || semFilter) && (
                <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-tertiary)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 10 }}>📭</div>
                    <p style={{ fontWeight: 600 }}>No students found for this filter.</p>
                </div>
            )}
            {!loading && !yearFilter && !semFilter && (
                <div style={{ textAlign: 'center', padding: '50px 0', borderRadius: 12, border: '2px dashed var(--border)', background: 'var(--bg-card)', color: 'var(--text-tertiary)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎓</div>
                    <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '0 0 6px' }}>
                        {tab === 'year' ? 'Select a year to promote' : 'Select a semester to advance'}
                    </p>
                    <p style={{ fontSize: '0.8rem', margin: 0 }}>Use the filter above to load students.</p>
                </div>
            )}

            {/* Confirm modal */}
            <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title={tab === 'year' ? 'Confirm Year Promotion' : 'Confirm Semester Advance'}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p style={{ margin: 0, fontSize: '0.87rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        You are about to <strong>{tab === 'year' ? 'promote the year' : 'advance the semester'}</strong> for <strong style={{ color: 'var(--text-primary)' }}>{selected.size} student(s)</strong>. This cannot be undone.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                        {tab === 'year' && willPromote.length > 0 && (
                            <div style={{ padding: 14, borderRadius: 10, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', textAlign: 'center' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803D', margin: 0 }}>{willPromote.length}</p>
                                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#166534', margin: '4px 0 0', textTransform: 'uppercase' }}>Promoted</p>
                            </div>
                        )}
                        {tab === 'year' && willGrad.length > 0 && (
                            <div style={{ padding: 14, borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', textAlign: 'center' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#4338CA', margin: 0 }}>{willGrad.length}</p>
                                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#3730A3', margin: '4px 0 0', textTransform: 'uppercase' }}>🎓 Graduate</p>
                            </div>
                        )}
                        {tab === 'semester' && (
                            <div style={{ padding: 14, borderRadius: 10, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', textAlign: 'center' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1D4ED8', margin: 0 }}>{selected.size}</p>
                                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#1E40AF', margin: '4px 0 0', textTransform: 'uppercase' }}>Sem Advanced</p>
                            </div>
                        )}
                        {skipped.length > 0 && (
                            <div style={{ padding: 14, borderRadius: 10, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', textAlign: 'center' }}>
                                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: '#D97706', margin: 0 }}>{skipped.length}</p>
                                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#B45309', margin: '4px 0 0', textTransform: 'uppercase' }}>⏸ Skipped</p>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                        <button className="btn btn-outline" onClick={() => setShowConfirm(false)} disabled={promoting}>Cancel</button>
                        <button className="btn btn-hod" onClick={doPromote} disabled={promoting}>
                            {promoting ? 'Processing…' : `✓ Confirm`}
                        </button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
