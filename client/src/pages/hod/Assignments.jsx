import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

const YEAR_LABELS = {
    1: '1st Year',
    2: '2nd Year',
    3: '3rd Year',
    4: '4th Year'
};

export default function HodAssignments() {
    const [assignments, setAssignments] = useState([]);
    const [faculty, setFaculty] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    // Filters & Search
    const [search, setSearch] = useState('');
    const [filterYear, setFilterYear] = useState('all');
    const [filterSection, setFilterSection] = useState('all');
    
    // Collapsible States
    const [expandedYears, setExpandedYears] = useState({
        '1st Year': false,
        '2nd Year': false,
        '3rd Year': false,
        '4th Year': false
    });
    const [expandedSections, setExpandedSections] = useState({});

    // Modal Form State
    const [form, setForm] = useState({
        faculty_id: '',
        subject_id: '',
        year: 1,
        section: 'A',
        is_class_teacher: false
    });

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const [aRes, fRes, sRes] = await Promise.all([
                api.get('/hod/assignments'),
                api.get('/hod/faculty'),
                api.get('/hod/subjects'),
            ]);
            setAssignments(aRes.data.raw || []);
            setFaculty(fRes.data.faculty || []);
            setSubjects(sRes.data.subjects || []);
        } catch { } finally { setLoading(false); }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.faculty_id || !form.subject_id) return alert('Please select both faculty and subject');
        try {
            await api.post('/hod/assignments', { ...form, academic_year_id: 1 });
            setShowModal(false);
            setForm({ faculty_id: '', subject_id: '', year: 1, section: 'A', is_class_teacher: false });
            load();
        } catch (err) {
            alert(err.response?.data?.error || 'Error creating assignment');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Remove this assignment? This will also delete related attendance and timetable records.')) return;
        try {
            await api.delete(`/hod/assignments/${id}`);
            load();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to remove assignment');
        }
    };

    // Client-side grouping, filtering and search
    const filteredAndGrouped = useMemo(() => {
        const q = search.trim().toLowerCase();
        const grouped = {};

        assignments.forEach(r => {
            const yearVal = r.year;
            const yearStr = YEAR_LABELS[yearVal] || `${yearVal}th Year`;
            const secKey = `Section ${r.section}`;

            // Year Filter
            if (filterYear !== 'all' && String(yearVal) !== String(filterYear)) {
                return;
            }

            // Section Filter
            if (filterSection !== 'all' && String(r.section) !== String(filterSection)) {
                return;
            }

            // Search Filter
            if (q) {
                const matchSubjectName = (r.subject_name || '').toLowerCase().includes(q);
                const matchSubjectCode = (r.subject_code || '').toLowerCase().includes(q);
                const matchFacultyName = (r.faculty_name || '').toLowerCase().includes(q);
                const matchFacultyLogin = (r.faculty_login || '').toLowerCase().includes(q);
                if (!matchSubjectName && !matchSubjectCode && !matchFacultyName && !matchFacultyLogin) {
                    return;
                }
            }

            if (!grouped[yearStr]) {
                grouped[yearStr] = {};
            }
            if (!grouped[yearStr][secKey]) {
                grouped[yearStr][secKey] = {
                    class_teacher: null,
                    subjects: []
                };
            }

            if (r.is_class_teacher) {
                grouped[yearStr][secKey].class_teacher = {
                    id: r.faculty_id,
                    name: r.faculty_name,
                    login_id: r.faculty_login
                };
            }

            grouped[yearStr][secKey].subjects.push(r);
        });

        return grouped;
    }, [assignments, search, filterYear, filterSection]);

    // Auto-expand search results
    useEffect(() => {
        const q = search.trim().toLowerCase();
        if (q) {
            setExpandedYears(prev => {
                const next = { ...prev };
                Object.keys(filteredAndGrouped).forEach(yearStr => {
                    next[yearStr] = true;
                });
                return next;
            });

            setExpandedSections(prev => {
                const next = { ...prev };
                Object.entries(filteredAndGrouped).forEach(([yearStr, sections]) => {
                    Object.keys(sections).forEach(secKey => {
                        next[`${yearStr}-${secKey}`] = true;
                    });
                });
                return next;
            });
        }
    }, [search, filteredAndGrouped]);

    // Subjects in modal based on selected year
    const modalFilteredSubjects = useMemo(() => {
        return subjects.filter(s => Number(s.academic_year) === Number(form.year));
    }, [subjects, form.year]);

    const toggleYear = (yearStr) => {
        setExpandedYears(prev => ({ ...prev, [yearStr]: !prev[yearStr] }));
    };

    const toggleSection = (yearStr, secKey) => {
        const key = `${yearStr}-${secKey}`;
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    const hasResults = Object.keys(filteredAndGrouped).length > 0;

    return (
        <DashboardLayout>
            <style>{`
                .search-filter-row {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 24px;
                    flex-wrap: wrap;
                }
                .search-box {
                    position: relative;
                    flex: 1;
                    min-width: 250px;
                }
                .search-icon {
                    position: absolute;
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-tertiary);
                    font-size: 0.9rem;
                    pointer-events: none;
                }
                .dropdown-filter {
                    width: 160px;
                }
                .year-panel {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    margin-bottom: 20px;
                    box-shadow: var(--shadow-sm);
                    overflow: hidden;
                    transition: border-color 0.2s;
                }
                .year-panel.expanded {
                    border-color: rgba(37,99,235,0.25);
                }
                .year-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 24px;
                    background: var(--bg-secondary);
                    cursor: pointer;
                    user-select: none;
                }
                .year-header:hover {
                    background: rgba(0,0,0,0.015);
                }
                .year-title {
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .year-badge {
                    font-size: 0.72rem;
                    padding: 2px 8px;
                    border-radius: 100px;
                    background: rgba(37,99,235,0.1);
                    color: #2563EB;
                    font-weight: 700;
                }
                .section-container {
                    padding: 16px 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    background: #fff;
                }
                .section-card {
                    border: 1.5px solid var(--border);
                    border-radius: 8px;
                    overflow: hidden;
                }
                .section-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 18px;
                    background: rgba(243,244,246,0.5);
                    cursor: pointer;
                    user-select: none;
                }
                .section-header:hover {
                    background: rgba(243,244,246,0.8);
                }
                .section-title-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .section-title {
                    font-size: 0.94rem;
                    font-weight: 700;
                    color: var(--text-primary);
                }
                .ct-badge {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    background: rgba(0,0,0,0.05);
                    padding: 2px 8px;
                    border-radius: 4px;
                }
                .ct-badge-active {
                    color: #15803D;
                    background: rgba(22,163,74,0.08);
                    border: 1px solid rgba(22,163,74,0.15);
                }
                .section-content {
                    border-top: 1px solid var(--border);
                }
                .highlighted-row {
                    background: rgba(37,99,235,0.05) !important;
                }
                .highlight-cell {
                    animation: pulse 1.5s infinite alternate;
                }
                @keyframes pulse {
                    from { background-color: rgba(37,99,235,0.02); }
                    to { background-color: rgba(37,99,235,0.08); }
                }
            `}</style>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>Class Assignments</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, margin: 0 }}>Assign faculty to subjects for each year & section</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-hod">+ Assign Faculty</button>
            </div>

            {/* Filters Bar */}
            <div className="search-filter-row">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        className="form-input"
                        style={{ paddingLeft: 34 }}
                        placeholder="Search subject code, name, faculty..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{
                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)'
                        }}>✕</button>
                    )}
                </div>
                <select
                    className="form-input dropdown-filter"
                    value={filterYear}
                    onChange={e => setFilterYear(e.target.value)}
                >
                    <option value="all">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                </select>
                <select
                    className="form-input dropdown-filter"
                    value={filterSection}
                    onChange={e => setFilterSection(e.target.value)}
                >
                    <option value="all">All Sections</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                </select>
            </div>

            {/* Assignments Hierarchy */}
            <div>
                {!hasResults ? (
                    <div style={{
                        textAlign: 'center', padding: '60px 20px', borderRadius: 12,
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        color: 'var(--text-tertiary)', fontSize: '0.9rem'
                    }}>
                        No assignments found matching the criteria.
                    </div>
                ) : (
                    [1, 2, 3, 4].map(year => {
                        const yearStr = YEAR_LABELS[year];
                        const sections = filteredAndGrouped[yearStr] || {};
                        
                        if (filterYear !== 'all' && String(year) !== String(filterYear)) {
                            return null;
                        }
                        if (Object.keys(sections).length === 0) {
                            return null;
                        }

                        const isYearOpen = expandedYears[yearStr];
                        const totalSubjects = Object.values(sections).reduce((acc, curr) => acc + curr.subjects.length, 0);

                        return (
                            <div key={year} className={`year-panel ${isYearOpen ? 'expanded' : ''}`}>
                                <div className="year-header" onClick={() => toggleYear(yearStr)}>
                                    <div className="year-title">
                                        <span>{yearStr}</span>
                                        <span className="year-badge">{totalSubjects} Assignments</span>
                                    </div>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', transform: isYearOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                                </div>

                                {isYearOpen && (
                                    <div className="section-container">
                                        {Object.entries(sections).map(([secKey, secData]) => {
                                            const secOpenKey = `${yearStr}-${secKey}`;
                                            const isSecOpen = expandedSections[secOpenKey];
                                            const ct = secData.class_teacher;

                                            return (
                                                <div key={secKey} className="section-card">
                                                    <div className="section-header" onClick={() => toggleSection(yearStr, secKey)}>
                                                        <div className="section-title-wrapper">
                                                            <span className="section-title">{secKey}</span>
                                                            <span className={`ct-badge ${ct ? 'ct-badge-active' : ''}`}>
                                                                👤 Class Teacher: {ct ? `${ct.name} (${ct.login_id})` : 'Not Assigned'}
                                                            </span>
                                                        </div>
                                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', transform: isSecOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                                                    </div>

                                                    {isSecOpen && (
                                                        <div className="section-content">
                                                            <table className="data-table" style={{ margin: 0, border: 'none' }}>
                                                                <thead>
                                                                    <tr>
                                                                        <th style={{ paddingLeft: 18 }}>Subject</th>
                                                                        <th>Faculty Member</th>
                                                                        <th style={{ width: '100px', textAlign: 'right', paddingRight: 18 }}>Actions</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {secData.subjects.map(s => {
                                                                        const q = search.trim().toLowerCase();
                                                                        const isMatch = q && (
                                                                            (s.subject_name || '').toLowerCase().includes(q) ||
                                                                            (s.subject_code || '').toLowerCase().includes(q) ||
                                                                            (s.faculty_name || '').toLowerCase().includes(q) ||
                                                                            (s.faculty_login || '').toLowerCase().includes(q)
                                                                        );

                                                                        return (
                                                                            <tr key={s.id} className={isMatch ? 'highlighted-row' : ''}>
                                                                                <td style={{ paddingLeft: 18 }} className={isMatch ? 'highlight-cell' : ''}>
                                                                                    <span style={{ fontWeight: 600 }}>{s.subject_name}</span>
                                                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginLeft: 6 }}>({s.subject_code})</span>
                                                                                </td>
                                                                                <td className={isMatch ? 'highlight-cell' : ''}>
                                                                                    <span style={{ fontWeight: 500 }}>{s.faculty_name}</span>
                                                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginLeft: 6 }}>({s.faculty_login})</span>
                                                                                </td>
                                                                                <td style={{ textAlign: 'right', paddingRight: 18 }}>
                                                                                    <button onClick={() => handleDelete(s.id)} className="btn btn-sm btn-danger" style={{ padding: '4px 10px', fontSize: '0.74rem' }}>Remove</button>
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

            {/* Modal Dialog */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Assign Faculty to Class">
                <form onSubmit={handleCreate} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Class Setup</p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Academic Year <span className="required">*</span></label>
                                <select 
                                    className="form-input" 
                                    value={form.year} 
                                    onChange={e => setForm({ ...form, year: parseInt(e.target.value), subject_id: '' })}
                                    required
                                >
                                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Section <span className="required">*</span></label>
                                <select 
                                    className="form-input" 
                                    value={form.section} 
                                    onChange={e => setForm({ ...form, section: e.target.value })}
                                    required
                                >
                                    {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>Section {s}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="modal-section">
                        <p className="modal-section-title">Assignment Details</p>
                        <div className="form-group">
                            <label className="form-label">Subject <span className="required">*</span></label>
                            <select 
                                className="form-input" 
                                value={form.subject_id} 
                                onChange={e => setForm({ ...form, subject_id: parseInt(e.target.value) })}
                                required
                            >
                                <option value="">— Select Subject —</option>
                                {modalFilteredSubjects.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.code}) — Sem {s.semester}</option>
                                ))}
                            </select>
                            {modalFilteredSubjects.length === 0 && (
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                                    No subjects found for {YEAR_LABELS[form.year]}. Add subjects first.
                                </p>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Faculty Member <span className="required">*</span></label>
                            <select 
                                className="form-input" 
                                value={form.faculty_id} 
                                onChange={e => setForm({ ...form, faculty_id: parseInt(e.target.value) })}
                                required
                            >
                                <option value="">— Select Faculty —</option>
                                {faculty.filter(f => f.is_active).map(f => (
                                    <option key={f.id} value={f.id}>{f.full_name} ({f.login_id})</option>
                                ))}
                            </select>
                        </div>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)',
                            marginTop: 14
                        }}>
                            <input 
                                type="checkbox" 
                                checked={form.is_class_teacher}
                                onChange={e => setForm({ ...form, is_class_teacher: e.target.checked })}
                                style={{ width: 16, height: 16, borderRadius: 4 }} 
                            />
                            Designate as Class Teacher for this section
                        </label>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-hod" disabled={modalFilteredSubjects.length === 0}>Create Assignment</button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
