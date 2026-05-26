import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import { HiOutlineTrash, HiOutlineChevronDown, HiOutlineChevronUp } from 'react-icons/hi';

/* ─── DeptTabs — uses REAL data from enriched API ───────────────────────────── */
function DeptTabs({ dept, students: allStudents = [], faculty }) {
    const [tab, setTab] = useState('students');
    const [studentsData, setStudentsData] = useState({ summary: {}, data: {}, students: [] });
    const [loadingStudents, setLoadingStudents] = useState(true);
    
    // Filter states
    const [year, setYear] = useState('all');
    const [section, setSection] = useState('all');
    const [sortBy, setSortBy] = useState('cgpa');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Collapsible states
    const [expandedYears, setExpandedYears] = useState({
        '1st Year': false,
        '2nd Year': false,
        '3rd Year': false,
        '4th Year': false
    });
    const [expandedSections, setExpandedSections] = useState({});
    
    // Quick View Modal
    const [viewStudent, setViewStudent] = useState(null);

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search);
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    // Fetch students on filter changes
    useEffect(() => {
        let isMounted = true;
        const fetchStudents = async () => {
            setLoadingStudents(true);
            try {
                const res = await api.get(`/principal/departments/${dept.id}/students`, {
                    params: { year, section, sortBy, search: debouncedSearch }
                });
                if (isMounted) {
                    setStudentsData(res.data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                if (isMounted) {
                    setLoadingStudents(false);
                }
            }
        };
        fetchStudents();
        return () => { isMounted = false; };
    }, [dept.id, year, section, sortBy, debouncedSearch]);

    // Auto-expand search results
    useEffect(() => {
        if (debouncedSearch.trim() && Object.keys(studentsData.data || {}).length > 0) {
            setExpandedYears(prev => {
                const next = { ...prev };
                Object.keys(studentsData.data).forEach(y => {
                    next[y] = true;
                });
                return next;
            });
            setExpandedSections(prev => {
                const next = { ...prev };
                Object.entries(studentsData.data).forEach(([y, secs]) => {
                    Object.keys(secs || {}).forEach(s => {
                        next[`${y}-${s}`] = true;
                    });
                });
                return next;
            });
        }
    }, [debouncedSearch, studentsData.data]);

    const toggleYear = (yearStr) => {
        setExpandedYears(prev => ({ ...prev, [yearStr]: !prev[yearStr] }));
    };

    const toggleSection = (yearStr, secStr) => {
        const key = `${yearStr}-${secStr}`;
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const tabs = [
        { key: 'students', label: 'Students' },
        { key: 'faculty', label: 'Faculty' },
        { key: 'alerts', label: 'Alerts' },
    ];

    const defaulters = (allStudents || []).filter(s => s.att != null && s.att < 75);
    const hasBacklogs = (allStudents || []).filter(s => s.backlogs > 0);

    const summary = studentsData.summary || { students: 0, avgAttendance: 0, avgCGPA: 0, backlogs: 0 };
    const groupedData = studentsData.data || {};

    return (
        <div style={{ padding: '0 0 4px 0' }}>
            <style>{`
                .principal-filters-bar {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                }
                .principal-filter-input {
                    padding: 8px 12px;
                    font-size: 0.8rem;
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    background: var(--bg-card);
                    color: var(--text-primary);
                    outline: none;
                }
                .principal-filter-input:focus {
                    border-color: #1A3C6E;
                }
                .p-summary-stats-bar {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    background: rgba(26,60,110,0.04);
                    border: 1px solid rgba(26,60,110,0.1);
                    border-radius: 10px;
                    padding: 12px;
                    margin-bottom: 16px;
                }
                .p-stat-item {
                    text-align: center;
                }
                .p-stat-val {
                    font-size: 1.15rem;
                    font-weight: 800;
                    color: #1A3C6E;
                    margin: 0;
                }
                .p-stat-lbl {
                    font-size: 0.65rem;
                    font-weight: 600;
                    color: var(--text-tertiary);
                    text-transform: uppercase;
                    margin-top: 2px;
                    margin: 0;
                }
                .p-year-accordion {
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    margin-bottom: 10px;
                    background: var(--bg-card);
                    overflow: hidden;
                }
                .p-year-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 16px;
                    background: var(--bg-secondary);
                    cursor: pointer;
                    user-select: none;
                    font-weight: 700;
                    font-size: 0.88rem;
                    color: var(--text-primary);
                }
                .p-year-body {
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .p-section-accordion {
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    overflow: hidden;
                }
                .p-section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 14px;
                    background: rgba(0,0,0,0.02);
                    cursor: pointer;
                    user-select: none;
                    font-weight: 600;
                    font-size: 0.82rem;
                    color: var(--text-secondary);
                }
                .p-section-body {
                    border-top: 1px solid var(--border);
                }
                .p-highlight-row {
                    background: rgba(37,99,235,0.06) !important;
                }
                .p-status-badge {
                    font-size: 0.68rem;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 4px;
                }
                .p-status-badge.active {
                    background: rgba(22,163,74,0.1);
                    color: #16A34A;
                }
                .p-status-badge.inactive {
                    background: rgba(220,38,38,0.1);
                    color: #DC2626;
                }
                .p-quick-view-btn {
                    padding: 3px 8px;
                    font-size: 0.72rem;
                    font-weight: 600;
                    background: transparent;
                    border: 1px solid #1A3C6E;
                    color: #1A3C6E;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .p-quick-view-btn:hover {
                    background: #1A3C6E;
                    color: white;
                }
            `}</style>

            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingLeft: 20 }}>
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        style={{
                            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
                            fontSize: '0.82rem', fontWeight: tab === t.key ? 700 : 500,
                            color: tab === t.key ? '#1A3C6E' : 'var(--text-secondary)',
                            borderBottom: tab === t.key ? '2.5px solid #1A3C6E' : '2.5px solid transparent',
                            transition: 'all 0.15s',
                        }}>{t.label}
                        {t.key === 'alerts' && (defaulters.length + hasBacklogs.length) > 0 && (
                            <span style={{
                                marginLeft: 6, padding: '1px 6px', borderRadius: 100,
                                background: '#DC2626', color: 'white', fontSize: '0.65rem', fontWeight: 800,
                            }}>{defaulters.length + hasBacklogs.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div style={{ padding: '16px 20px', maxHeight: 420, overflowY: 'auto' }}>

                {/* Students tab — restructured year-wise collapsible hierarchy */}
                {tab === 'students' && (
                    <div>
                        {/* Filters Bar */}
                        <div className="principal-filters-bar">
                            <input
                                className="principal-filter-input"
                                style={{ flex: 1, minWidth: '160px' }}
                                placeholder="🔍 Search name, roll..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <select
                                className="principal-filter-input"
                                value={year}
                                onChange={e => setYear(e.target.value)}
                            >
                                <option value="all">All Years</option>
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                            </select>
                            <select
                                className="principal-filter-input"
                                value={section}
                                onChange={e => setSection(e.target.value)}
                            >
                                <option value="all">All Sections</option>
                                <option value="A">Section A</option>
                                <option value="B">Section B</option>
                                <option value="C">Section C</option>
                                <option value="D">Section D</option>
                            </select>
                            <select
                                className="principal-filter-input"
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                            >
                                <option value="cgpa">Sort by CGPA</option>
                                <option value="attendance">Sort by Attendance</option>
                                <option value="leastBacklogs">Sort by Least Backlogs</option>
                                <option value="highestBacklogs">Sort by Highest Backlogs</option>
                                <option value="alphabetical">Sort Alphabetical</option>
                            </select>
                        </div>

                        {/* Dynamic Summary Stats Bar */}
                        <div className="p-summary-stats-bar">
                            <div className="p-stat-item">
                                <p className="p-stat-val">{summary.students || 0}</p>
                                <p className="p-stat-lbl">Students</p>
                            </div>
                            <div className="p-stat-item">
                                <p className="p-stat-val" style={{ color: (summary.avgAttendance || 0) >= 75 ? '#16A34A' : '#DC2626' }}>
                                    {summary.avgAttendance || 0}%
                                </p>
                                <p className="p-stat-lbl">Avg Attend.</p>
                            </div>
                            <div className="p-stat-item">
                                <p className="p-stat-val" style={{ color: (summary.avgCGPA || 0) >= 7 ? '#16A34A' : '#D97706' }}>
                                    {Number(summary.avgCGPA || 0).toFixed(2)}
                                </p>
                                <p className="p-stat-lbl">Avg CGPA</p>
                            </div>
                            <div className="p-stat-item">
                                <p className="p-stat-val" style={{ color: (summary.backlogs || 0) > 0 ? '#DC2626' : 'var(--text-tertiary)' }}>
                                    {summary.backlogs || 0}
                                </p>
                                <p className="p-stat-lbl">Backlogs</p>
                            </div>
                        </div>

                        {/* Loading / Results display */}
                        {loadingStudents ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}><LoadingSpinner /></div>
                        ) : Object.keys(groupedData).length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 30, fontSize: '0.85rem' }}>No students found matching filters</div>
                        ) : (
                            ['1st Year', '2nd Year', '3rd Year', '4th Year'].map(yearStr => {
                                const sections = groupedData[yearStr] || {};
                                if (Object.keys(sections).length === 0) return null;

                                const isYearOpen = expandedYears[yearStr];

                                return (
                                    <div key={yearStr} className="p-year-accordion">
                                        <div className="p-year-header" onClick={() => toggleYear(yearStr)}>
                                            <span>{yearStr}</span>
                                            <span style={{ fontSize: '0.75rem', transform: isYearOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                                        </div>

                                        {isYearOpen && (
                                            <div className="p-year-body">
                                                {Object.entries(sections).map(([secStr, list]) => {
                                                    const isSecOpen = expandedSections[`${yearStr}-${secStr}`];

                                                    return (
                                                        <div key={secStr} className="p-section-accordion">
                                                            <div className="p-section-header" onClick={() => toggleSection(yearStr, secStr)}>
                                                                <span>{secStr}</span>
                                                                <span style={{ fontSize: '0.7rem', transform: isSecOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                                                            </div>

                                                            {isSecOpen && (
                                                                <div className="p-section-body">
                                                                    <table className="data-table" style={{ margin: 0, border: 'none' }}>
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Rank</th>
                                                                                <th>Name / Roll</th>
                                                                                <th>CGPA</th>
                                                                                <th>Attendance</th>
                                                                                <th>Backlogs</th>
                                                                                <th>Status</th>
                                                                                <th style={{ textAlign: 'right', paddingRight: 14 }}>Actions</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {list.map(s => {
                                                                                const q = debouncedSearch.trim().toLowerCase();
                                                                                const isMatch = q && (
                                                                                    (s.full_name || '').toLowerCase().includes(q) ||
                                                                                    (s.roll_number || '').toLowerCase().includes(q)
                                                                                );

                                                                                return (
                                                                                    <tr key={s.id} className={isMatch ? 'p-highlight-row' : ''}>
                                                                                        <td style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>#{s.rank}</td>
                                                                                        <td>
                                                                                            <div style={{ fontWeight: 600, fontSize: '0.83rem' }}>{s.full_name}</div>
                                                                                            <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{s.roll_number}</div>
                                                                                        </td>
                                                                                        <td>
                                                                                            {s.cgpa != null
                                                                                                ? <span style={{ fontWeight: 800, color: s.cgpa >= 8 ? '#16A34A' : s.cgpa >= 6 ? '#D97706' : '#DC2626' }}>{Number(s.cgpa).toFixed(2)}</span>
                                                                                                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                                                                                        </td>
                                                                                        <td>
                                                                                            {s.att != null
                                                                                                ? <span style={{ fontWeight: 700, color: s.att >= 75 ? '#16A34A' : '#DC2626' }}>{s.att}%</span>
                                                                                                : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                                                                                        </td>
                                                                                        <td>
                                                                                            {s.backlogs > 0
                                                                                                ? <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>⚠ {s.backlogs}</span>
                                                                                                : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>—</span>}
                                                                                        </td>
                                                                                        <td>
                                                                                            <span className={`p-status-badge ${s.status === 'Active' ? 'active' : 'inactive'}`}>
                                                                                                {s.status}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td style={{ textAlign: 'right', paddingRight: 14 }}>
                                                                                            <button onClick={() => setViewStudent(s)} className="p-quick-view-btn">Quick View</button>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Faculty tab — real data */}
                {tab === 'faculty' && (
                    <table className="data-table" style={{ margin: 0 }}>
                        <thead><tr><th>Faculty Name</th><th>Login ID</th><th>Designation</th></tr></thead>
                        <tbody>
                            {(faculty || []).map((f) => (
                                <tr key={f.id}>
                                    <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{f.full_name}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{f.login_id}</td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{f.designation || '—'}</td>
                                </tr>
                            ))}
                            {(!faculty || faculty.length === 0) && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 20 }}>No faculty</td></tr>}
                        </tbody>
                    </table>
                )}

                {/* Alerts tab — real data */}
                {tab === 'alerts' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {defaulters.length === 0 && hasBacklogs.length === 0 && (
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>✅ No active alerts for this department.</p>
                        )}
                        {defaulters.map((s, i) => (
                            <div key={`def-${i}`} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.2)', fontSize: '0.82rem', color: '#B45309' }}>
                                ⚠ <strong>{s.full_name}</strong> ({s.roll_number}) — Attendance {s.att}% &lt; 75% — Defaulter
                            </div>
                        ))}
                        {hasBacklogs.map((s, i) => (
                            <div key={`bl-${i}`} style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.18)', fontSize: '0.82rem', color: '#B91C1C' }}>
                                📚 <strong>{s.full_name}</strong> ({s.roll_number}) — {s.backlogs} Backlog{s.backlogs > 1 ? 's' : ''}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Quick View Student Modal */}
            <Modal isOpen={!!viewStudent} onClose={() => setViewStudent(null)} title="Student Academic Profile" size="sm">
                {viewStudent && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1A3C6E' }}>{viewStudent.full_name}</h3>
                            <p style={{ margin: '4px 0 0 0', fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Roll No: {viewStudent.roll_number}</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', fontSize: '0.82rem' }}>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, display: 'block' }}>Email Address</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{viewStudent.email || '—'}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, display: 'block' }}>Department</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dept.code}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, display: 'block' }}>Academic Year</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Year {viewStudent.year} (Sem {viewStudent.semester})</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, display: 'block' }}>Section</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Section {viewStudent.section || 'A'}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, display: 'block' }}>CGPA</span>
                                <span style={{ fontWeight: 700, color: (viewStudent.cgpa || 0) >= 8 ? '#16A34A' : '#D97706' }}>
                                    {viewStudent.cgpa != null ? Number(viewStudent.cgpa).toFixed(2) : '—'}
                                </span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, display: 'block' }}>Attendance</span>
                                <span style={{ fontWeight: 700, color: (viewStudent.att || 0) >= 75 ? '#16A34A' : '#DC2626' }}>
                                    {viewStudent.att != null ? `${viewStudent.att}%` : '—'}
                                </span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, display: 'block' }}>Backlogs</span>
                                <span style={{ fontWeight: 700, color: viewStudent.backlogs > 0 ? '#DC2626' : 'var(--text-secondary)' }}>
                                    {viewStudent.backlogs > 0 ? `⚠ ${viewStudent.backlogs} Active` : 'None'}
                                </span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)', fontWeight: 600, display: 'block' }}>Account Status</span>
                                <span className={`p-status-badge ${viewStudent.status === 'Active' ? 'active' : 'inactive'}`} style={{ display: 'inline-block', marginTop: 3 }}>
                                    {viewStudent.status}
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6 }}>
                            <button onClick={() => setViewStudent(null)} className="btn btn-outline" style={{ padding: '6px 16px', fontSize: '0.82rem' }}>Close</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */
export default function Departments() {
    const [departments, setDepartments] = useState([]);
    const [deptDetails, setDeptDetails] = useState({}); // { deptId: { students, faculty } }
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [form, setForm] = useState({ name: '', code: '' });
    const [expanded, setExpanded] = useState({}); // { deptId: bool }

    useEffect(() => { load(); }, []);
    const load = async () => {
        try { const r = await api.get('/principal/departments'); setDepartments(r.data.departments); }
        catch { } finally { setLoading(false); }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try { await api.post('/principal/departments', form); setShowModal(false); setForm({ name: '', code: '' }); load(); }
        catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/principal/departments/${deleteTarget.id}`);
            setDeleteTarget(null);
            load();
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to delete department. Please try again.';
            alert(msg);
        } finally {
            setDeleting(false);
        }
    };

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const toggleExpand = async (dept) => {
        const id = dept.id;
        const isOpen = expanded[id];
        setExpanded(prev => ({ ...prev, [id]: !isOpen }));

        if (!isOpen && !deptDetails[id]) {
            try {
                // Try to load per-dept detail — fallback to principal students/faculty endpoints
                const [sRes, fRes] = await Promise.allSettled([
                    api.get(`/principal/departments/${id}/students`),
                    api.get(`/principal/departments/${id}/faculty`),
                ]);
                setDeptDetails(prev => ({
                    ...prev,
                    [id]: {
                        students: sRes.status === 'fulfilled' ? sRes.value.data.students || [] : [],
                        faculty: fRes.status === 'fulfilled' ? fRes.value.data.faculty || [] : [],
                    }
                }));
            } catch {
                setDeptDetails(prev => ({ ...prev, [id]: { students: [], faculty: [] } }));
            }
        }
    };

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    /* ── Global summary — use real data from departments API ── */
    const totalStudents = departments.reduce((a, d) => a + (Number(d.student_count) || 0), 0);
    const totalFaculty  = departments.reduce((a, d) => a + (Number(d.faculty_count) || 0), 0);
    const totalBacklogs = departments.reduce((a, d) => a + (Number(d.active_backlogs) || 0), 0);
    const deptsWithAtt  = departments.filter(d => d.avg_attendance != null);
    const globalAvgAtt  = deptsWithAtt.length
        ? Math.round(deptsWithAtt.reduce((a, d) => a + d.avg_attendance, 0) / deptsWithAtt.length * 10) / 10
        : null;
    const deptsWithCgpa = departments.filter(d => d.avg_cgpa != null);
    const globalAvgCgpa = deptsWithCgpa.length
        ? Math.round(deptsWithCgpa.reduce((a, d) => a + d.avg_cgpa, 0) / deptsWithCgpa.length * 100) / 100
        : null;

    const summaryItems = [
        { label: 'Total Students',        value: totalStudents,                                  color: '#6A1B9A' },
        { label: 'Total Faculty',          value: totalFaculty,                                   color: '#1565C0' },
        { label: 'Overall Avg CGPA',       value: globalAvgCgpa != null ? globalAvgCgpa : '—',  color: '#2E7D32' },
        { label: 'Overall Avg Attendance', value: globalAvgAtt  != null ? `${globalAvgAtt}%` : '—', color: (globalAvgAtt || 0) >= 75 ? '#2E7D32' : '#DC2626' },
        { label: 'Total Active Backlogs',  value: totalBacklogs,                                  color: '#DC2626' },
    ];

    return (
        <DashboardLayout>
            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Departments</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Manage academic departments — click ▼ to expand details</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-principal">+ New Department</button>
            </div>

            {/* ── Global Summary Bar ───────────────────────────────────────────────── */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24,
                padding: '16px 20px', borderRadius: 14,
                background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
            }}>
                {summaryItems.map((item, i) => (
                    <div key={i} style={{ textAlign: 'center', padding: '10px 0' }}>
                        <p style={{ fontSize: '1.35rem', fontWeight: 900, color: item.color, margin: 0 }}>{item.value}</p>
                        <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Department Expandable Cards ──────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {departments.map(dept => {
                    const isOpen = !!expanded[dept.id];
                    const details = deptDetails[dept.id] || {};
                    const deptStudents = details.students || [];
                    const deptFaculty = details.faculty || [];
                    const deptAvgAtt  = dept.avg_attendance  != null ? Number(dept.avg_attendance).toFixed(1)  : null;
                    const deptAvgCgpa = dept.avg_cgpa         != null ? Number(dept.avg_cgpa).toFixed(2)        : null;
                    const deptBacklogs = dept.active_backlogs || 0;

                    return (
                        <div key={dept.id} style={{
                            borderRadius: 14, overflow: 'hidden',
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-sm)',
                        }}>
                            {/* Top gradient */}
                            <div style={{ height: 4, background: 'linear-gradient(90deg, #1A3C6E, #E8A020)' }} />

                            {/* Summary row */}
                            <div style={{
                                padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                            }}>
                                {/* Code pill + Name */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: '#1A3C6E', color: 'white', fontWeight: 800, fontSize: '0.68rem', letterSpacing: '0.05em',
                                    }}>{dept.code}</div>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>{dept.name}</p>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: 0 }}>{dept.code}</p>
                                    </div>
                                </div>

                                {/* Stats row */}
                                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', flex: 1 }}>
                                    {[
                                        { label: 'Students',     value: dept.student_count || 0,                               color: '#6A1B9A' },
                                        { label: 'Faculty',      value: dept.faculty_count  || 0,                               color: '#1565C0' },
                                        { label: 'Avg Attend.',  value: deptAvgAtt  != null ? `${deptAvgAtt}%`  : '—',        color: deptAvgAtt  != null && Number(deptAvgAtt)  >= 75 ? '#16A34A' : '#DC2626' },
                                        { label: 'Avg CGPA',     value: deptAvgCgpa != null ? deptAvgCgpa        : '—',        color: deptAvgCgpa != null && Number(deptAvgCgpa) >= 7  ? '#16A34A' : '#D97706' },
                                        { label: 'Backlogs',     value: deptBacklogs > 0    ? `⚠ ${deptBacklogs}` : '—',     color: deptBacklogs > 0 ? '#DC2626' : 'var(--text-tertiary)' },
                                    ].map((s, i) => (
                                        <div key={i} style={{ textAlign: 'center', minWidth: 60 }}>
                                            <p style={{ fontSize: '1rem', fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                                            <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{s.label}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                                    <button
                                        onClick={() => toggleExpand(dept)}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            padding: '7px 14px', borderRadius: 8,
                                            border: '1.5px solid var(--border)',
                                            background: isOpen ? 'rgba(26,60,110,0.07)' : 'var(--bg-secondary)',
                                            color: isOpen ? '#1A3C6E' : 'var(--text-secondary)',
                                            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {isOpen ? <HiOutlineChevronUp size={14} /> : <HiOutlineChevronDown size={14} />}
                                        {isOpen ? 'Collapse' : 'View Details'}
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget({ id: dept.id, name: dept.name })}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                            padding: '7px 12px', borderRadius: 8, border: '1.5px solid #FCA5A5',
                                            background: 'rgba(220,38,38,0.06)', color: '#DC2626',
                                            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#DC2626'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = '#FCA5A5'; }}
                                    >
                                        <HiOutlineTrash size={13} />
                                    </button>
                                </div>
                            </div>

                            {/* Expanded detail */}
                            {isOpen && (
                                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                                    <DeptTabs dept={dept} students={deptStudents} faculty={deptFaculty} />
                                </div>
                            )}
                        </div>
                    );
                })}

                {departments.length === 0 && (
                    <div style={{ borderRadius: 14, padding: '48px 24px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>No departments yet — create one above</p>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Department" size="sm">
                <form onSubmit={handleCreate} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Department Details</p>
                        <div className="form-group">
                            <label className="form-label">Department Name <span className="required">*</span></label>
                            <input className="form-input" value={form.name} onChange={e => upd('name', e.target.value)} required placeholder="e.g. Computer Science & Engineering" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Department Code <span className="required">*</span></label>
                            <input className="form-input" value={form.code} onChange={e => upd('code', e.target.value.toUpperCase())} required placeholder="e.g. CSE" />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-principal">Create Department</button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove Department" size="sm">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <HiOutlineTrash size={24} color="#DC2626" />
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 8 }}>Remove <span style={{ color: '#DC2626' }}>{deleteTarget?.name}</span>?</p>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            This will permanently delete the department and <strong>all associated data</strong> including:
                            subjects, class assignments, attendance records, and marks.<br />
                            <strong>Departments with active students or faculty cannot be deleted.</strong>
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', paddingTop: 4 }}>
                        <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: deleting ? '#9CA3AF' : '#DC2626', color: 'white', fontWeight: 600, fontSize: '0.875rem', cursor: deleting ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
                            {deleting ? 'Removing...' : 'Yes, Remove'}
                        </button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
