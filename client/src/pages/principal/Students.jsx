import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import {
    HiOutlineSearch, HiOutlineAcademicCap, HiOutlineChartBar,
    HiOutlineExclamation, HiOutlineCheckCircle, HiOutlineX,
    HiOutlineFilter, HiOutlineRefresh,
} from 'react-icons/hi';

const BAND_COLORS = {
    good:     { bg: 'rgba(46,125,50,0.1)',   text: '#2E7D32',  label: '≥ 75%' },
    low:      { bg: 'rgba(245,127,23,0.12)', text: '#E65100',  label: '60–74%' },
    critical: { bg: 'rgba(183,28,28,0.1)',   text: '#B71C1C',  label: '< 60%' },
    none:     { bg: 'rgba(100,100,100,0.08)', text: '#666',    label: 'N/A' },
};

function band(pct) {
    if (pct === null || pct === undefined) return 'none';
    if (pct >= 75) return 'good';
    if (pct >= 60) return 'low';
    return 'critical';
}

function AttBadge({ pct }) {
    const b = band(pct);
    const c = BAND_COLORS[b];
    return (
        <span style={{
            display: 'inline-block',
            padding: '2px 10px',
            borderRadius: 20,
            fontSize: '0.75rem',
            fontWeight: 700,
            background: c.bg,
            color: c.text,
            minWidth: 56,
            textAlign: 'center',
        }}>
            {pct !== null && pct !== undefined ? `${pct}%` : '—'}
        </span>
    );
}

export default function PrincipalStudents() {
    const [students, setStudents] = useState([]);
    const [summary, setSummary] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const LIMIT = 50;

    // Filters
    const [deptId, setDeptId] = useState('');
    const [year, setYear] = useState('');
    const [section, setSection] = useState('');
    const [attFilter, setAttFilter] = useState('');
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');

    // Drill-down
    const [selected, setSelected] = useState(null);
    const [drillData, setDrillData] = useState(null);
    const [drillLoading, setDrillLoading] = useState(false);

    // Load departments for filter dropdown
    useEffect(() => {
        api.get('/principal/departments').then(r => setDepartments(r.data.departments || [])).catch(() => {});
    }, []);

    const fetchStudents = useCallback(async (pg = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: pg, limit: LIMIT });
            if (deptId)    params.set('dept_id', deptId);
            if (year)      params.set('year', year);
            if (section)   params.set('section', section);
            if (attFilter) params.set('attendance', attFilter);
            if (search)    params.set('search', search);

            const r = await api.get(`/principal/students?${params}`);
            setStudents(r.data.students || []);
            setSummary(r.data.summary || null);
            setTotal(r.data.total || 0);
            setPage(pg);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [deptId, year, section, attFilter, search]);

    useEffect(() => { fetchStudents(1); }, [fetchStudents]);

    const openDrillDown = async (student) => {
        setSelected(student);
        setDrillData(null);
        setDrillLoading(true);
        try {
            const r = await api.get(`/principal/students/${student.id}/subjects`);
            setDrillData(r.data);
        } catch (err) {
            console.error(err);
        } finally {
            setDrillLoading(false);
        }
    };

    const totalPages = Math.ceil(total / LIMIT);

    const cardStyle = (color) => ({
        flex: 1, minWidth: 140,
        padding: '16px 20px',
        borderRadius: 14,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-sm)',
    });

    return (
        <DashboardLayout>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                    Student Overview
                </h1>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Institution-wide view across all departments · Current academic year
                </p>
            </div>

            {/* Summary Stat Cards */}
            {summary && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
                    {[
                        { label: 'Total Students', value: summary.total_students || total, color: '#1A3C6E', icon: HiOutlineAcademicCap },
                        { label: '✅ Good (≥75%)',  value: summary.good_attendance || 0,     color: '#2E7D32', icon: HiOutlineCheckCircle },
                        { label: '⚠️ Low (60–74%)', value: summary.low_attendance || 0,      color: '#E65100', icon: HiOutlineExclamation },
                        { label: '🚨 Critical (<60%)', value: summary.critical_attendance || 0, color: '#B71C1C', icon: HiOutlineChartBar },
                    ].map(({ label, value, color, icon: Icon }) => (
                        <div key={label} style={cardStyle(color)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                                    <Icon size={18} />
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                                    <p style={{ fontSize: '1.5rem', fontWeight: 800, color, margin: 0, lineHeight: 1.1 }}>{value}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div style={{
                display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
                marginBottom: 18, padding: '14px 16px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, boxShadow: 'var(--shadow-xs)'
            }}>
                <HiOutlineFilter size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />

                <select value={deptId} onChange={e => setDeptId(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <option value=''>All Departments</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>

                <select value={year} onChange={e => setYear(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <option value=''>All Years</option>
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>

                <select value={attFilter} onChange={e => setAttFilter(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <option value=''>All Attendance</option>
                    <option value='good'>Good (≥75%)</option>
                    <option value='low'>Low (60–74%)</option>
                    <option value='critical'>Critical (&lt;60%)</option>
                </select>

                {/* Search */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)', padding: '4px 10px' }}>
                    <HiOutlineSearch size={14} style={{ color: 'var(--text-tertiary)' }} />
                    <input
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput); }}
                        placeholder='Search name or roll no…'
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', color: 'var(--text-primary)', width: 180 }}
                    />
                    {search && <button onClick={() => { setSearch(''); setSearchInput(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}><HiOutlineX size={14} /></button>}
                </div>

                <button onClick={() => fetchStudents(1)}
                    style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HiOutlineRefresh size={14} /> Apply
                </button>
            </div>

            {/* Table */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div>
                ) : students.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        No students found matching the selected filters.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                                    {['Name', 'Roll No', 'Department', 'Year', 'Sec', 'Attendance', 'Sub < 75%', 'CGPA', 'Leaves'].map(h => (
                                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s, i) => (
                                    <tr key={s.id}
                                        onClick={() => openDrillDown(s)}
                                        style={{
                                            borderBottom: '1px solid var(--border)',
                                            cursor: 'pointer',
                                            background: selected?.id === s.id ? 'var(--bg-secondary)' : 'transparent',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => { if (selected?.id !== s.id) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                        onMouseLeave={e => { if (selected?.id !== s.id) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.full_name}</td>
                                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{s.roll_number}</td>
                                        <td style={{ padding: '10px 14px' }}>
                                            <span style={{ background: '#1A3C6E18', color: '#1A3C6E', padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>{s.dept_code}</span>
                                        </td>
                                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{s.year}</td>
                                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{s.section || '—'}</td>
                                        <td style={{ padding: '10px 14px' }}><AttBadge pct={s.overall_attendance_pct} /></td>
                                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                            {s.subjects_below_75 > 0
                                                ? <span style={{ color: '#B71C1C', fontWeight: 700 }}>{s.subjects_below_75}</span>
                                                : <span style={{ color: '#2E7D32' }}>0</span>}
                                        </td>
                                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{s.cgpa ? parseFloat(s.cgpa).toFixed(2) : '—'}</td>
                                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{s.total_leaves || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button disabled={page <= 1} onClick={() => fetchStudents(page - 1)}
                                style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: page > 1 ? 'pointer' : 'not-allowed', fontSize: '0.8rem', opacity: page <= 1 ? 0.4 : 1 }}>
                                ← Prev
                            </button>
                            <span style={{ padding: '5px 12px', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>{page} / {totalPages}</span>
                            <button disabled={page >= totalPages} onClick={() => fetchStudents(page + 1)}
                                style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: page < totalPages ? 'pointer' : 'not-allowed', fontSize: '0.8rem', opacity: page >= totalPages ? 0.4 : 1 }}>
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Drill-Down Panel */}
            {selected && (
                <div style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
                    background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
                    boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
                    zIndex: 100, display: 'flex', flexDirection: 'column',
                    animation: 'slideInRight 0.25s ease',
                }}>
                    {/* Panel header */}
                    <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Student Detail</p>
                            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{selected.full_name}</h2>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                                {selected.roll_number} · {selected.dept_name} · Year {selected.year} {selected.section}
                            </p>
                        </div>
                        <button onClick={() => { setSelected(null); setDrillData(null); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                            <HiOutlineX size={20} />
                        </button>
                    </div>

                    {/* Panel body */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                        {/* Quick stats row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                            {[
                                { label: 'Overall Att.', value: selected.overall_attendance_pct !== null ? `${selected.overall_attendance_pct}%` : '—', color: BAND_COLORS[band(selected.overall_attendance_pct)].text },
                                { label: 'CGPA', value: selected.cgpa ? parseFloat(selected.cgpa).toFixed(2) : '—', color: 'var(--text-primary)' },
                                { label: 'Below 75%', value: selected.subjects_below_75 || 0, color: selected.subjects_below_75 > 0 ? '#B71C1C' : '#2E7D32' },
                                { label: 'Leaves', value: selected.total_leaves || 0, color: 'var(--text-primary)' },
                            ].map(({ label, value, color }) => (
                                <div key={label} style={{ padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
                                    <p style={{ fontSize: '1.2rem', fontWeight: 800, color, margin: 0 }}>{value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Subject breakdown */}
                        <h3 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                            Subject-wise Attendance
                        </h3>
                        {drillLoading ? (
                            <div style={{ padding: 30, display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div>
                        ) : !drillData?.subjects?.length ? (
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', textAlign: 'center', padding: 20 }}>
                                No attendance data yet for this student.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {drillData.subjects.map((s, i) => {
                                    const b = s.attendance_band || band(s.percentage);
                                    const c = BAND_COLORS[b];
                                    const pct = s.percentage || 0;
                                    return (
                                        <div key={i} style={{ padding: '12px 14px', borderRadius: 10, border: `1px solid ${c.text}30`, background: c.bg }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                                <div>
                                                    <p style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', margin: 0 }}>{s.subject_name}</p>
                                                    <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', margin: '1px 0 0' }}>
                                                        {s.subject_code} · {s.dept_name} · Yr {s.year} {s.section}
                                                    </p>
                                                </div>
                                                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: c.text }}>{pct}%</span>
                                            </div>
                                            {/* Progress bar */}
                                            <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                                                <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: c.text, borderRadius: 4, transition: 'width 0.4s ease' }} />
                                            </div>
                                            <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                                                {s.attended_sessions || 0} / {s.total_sessions || 0} sessions
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to   { transform: translateX(0);    opacity: 1; }
                }
            `}</style>
        </DashboardLayout>
    );
}
