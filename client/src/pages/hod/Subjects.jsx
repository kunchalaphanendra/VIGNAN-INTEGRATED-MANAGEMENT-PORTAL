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

export default function HodSubjects() {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');
    const [filterYear, setFilterYear] = useState('all');
    const [expandedYears, setExpandedYears] = useState({ 1: false, 2: false, 3: false, 4: false });
    const [form, setForm] = useState({ name: '', code: '', semester: 1, credits: 3, academic_year: 1 });

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const r = await api.get('/hod/subjects');
            setSubjects(r.data.subjects || []);
        } catch { } finally { setLoading(false); }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hod/subjects', form);
            setShowModal(false);
            setForm({ name: '', code: '', semester: 1, credits: 3, academic_year: 1 });
            load();
        } catch (err) {
            alert(err.response?.data?.error || 'Error adding subject');
        }
    };

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // Filtered and grouped subjects
    const filteredGroups = useMemo(() => {
        const q = search.trim().toLowerCase();
        const groups = { 1: [], 2: [], 3: [], 4: [] };
        
        subjects.forEach(s => {
            const year = s.academic_year || 1;
            // Year filter dropdown
            if (filterYear !== 'all' && String(year) !== String(filterYear)) {
                return;
            }
            // Search query
            if (q) {
                const nameMatch = (s.name || '').toLowerCase().includes(q);
                const codeMatch = (s.code || '').toLowerCase().includes(q);
                if (!nameMatch && !codeMatch) return;
            }
            if (groups[year]) {
                groups[year].push(s);
            }
        });
        return groups;
    }, [subjects, search, filterYear]);

    // Automatically expand year groups when search query matches
    useEffect(() => {
        const q = search.trim().toLowerCase();
        if (q) {
            setExpandedYears(prev => {
                const next = { ...prev };
                Object.entries(filteredGroups).forEach(([year, list]) => {
                    if (list.length > 0) {
                        next[year] = true;
                    }
                });
                return next;
            });
        }
    }, [search, filteredGroups]);

    const toggleYear = (year) => {
        setExpandedYears(prev => ({ ...prev, [year]: !prev[year] }));
    };

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    // Count results total
    const totalResults = Object.values(filteredGroups).reduce((acc, curr) => acc + curr.length, 0);

    return (
        <DashboardLayout>
            <style>{`
                .collapsible-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    margin-bottom: 16px;
                    overflow: hidden;
                    box-shadow: var(--shadow-sm);
                    transition: all 0.2s ease;
                }
                .collapsible-card.expanded {
                    border-color: rgba(37,99,235,0.25);
                }
                .collapsible-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    background: var(--bg-secondary);
                    cursor: pointer;
                    user-select: none;
                    transition: background 0.15s;
                }
                .collapsible-header:hover {
                    background: rgba(0,0,0,0.02);
                }
                .collapsible-title {
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .badge {
                    font-size: 0.72rem;
                    padding: 3px 9px;
                    border-radius: 100px;
                    font-weight: 700;
                    background: rgba(37,99,235,0.1);
                    color: #2563EB;
                }
                .chevron {
                    font-size: 0.85rem;
                    color: var(--text-tertiary);
                    transition: transform 0.2s ease;
                }
                .chevron.rotated {
                    transform: rotate(180deg);
                }
                .collapsible-content {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s cubic-bezier(0, 1, 0, 1);
                }
                .collapsible-content.open {
                    max-height: 1000px;
                    transition: max-height 0.35s cubic-bezier(1, 0, 1, 0);
                    border-top: 1px solid var(--border);
                }
                .search-filter-bar {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }
                .search-wrapper {
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
                .filter-dropdown {
                    width: 180px;
                    font-weight: 600;
                    color: var(--text-secondary);
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div className="page-header-row" style={{ marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                        Subjects
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, margin: 0 }}>
                        Subjects offered in your department
                    </p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-hod">+ Add Subject</button>
            </div>

            {/* Search & Filter Bar */}
            <div className="search-filter-bar">
                <div className="search-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                        className="form-input"
                        style={{ paddingLeft: 34 }}
                        placeholder="Search subject code, name..."
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
                    className="form-input filter-dropdown"
                    value={filterYear}
                    onChange={e => setFilterYear(e.target.value)}
                >
                    <option value="all">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                </select>
            </div>

            {/* Collapsible Cards */}
            <div style={{ animation: 'fadeIn 0.25s ease' }}>
                {totalResults === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '60px 20px', borderRadius: 12,
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        color: 'var(--text-tertiary)', fontSize: '0.9rem'
                    }}>
                        No subjects found matching the criteria.
                    </div>
                ) : (
                    [1, 2, 3, 4].map(year => {
                        const list = filteredGroups[year] || [];
                        if (filterYear !== 'all' && String(year) !== String(filterYear)) {
                            return null;
                        }
                        if (search.trim() && list.length === 0) {
                            return null;
                        }
                        
                        const isOpen = expandedYears[year];

                        return (
                            <div key={year} className={`collapsible-card ${isOpen ? 'expanded' : ''}`}>
                                <div className="collapsible-header" onClick={() => toggleYear(year)}>
                                    <div className="collapsible-title">
                                        <span>{YEAR_LABELS[year]}</span>
                                        <span className="badge">{list.length} Subjects</span>
                                    </div>
                                    <span className={`chevron ${isOpen ? 'rotated' : ''}`}>▼</span>
                                </div>
                                <div className={`collapsible-content ${isOpen ? 'open' : ''}`}>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="data-table" style={{ margin: 0, border: 'none' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '150px', paddingLeft: 20 }}>Code</th>
                                                    <th>Subject Name</th>
                                                    <th style={{ width: '150px' }}>Semester</th>
                                                    <th style={{ width: '120px', paddingRight: 20 }}>Credits</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {list.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                                                            No subjects in this year
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    list.map(s => (
                                                        <tr key={s.id}>
                                                            <td style={{ paddingLeft: 20 }}><span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem' }}>{s.code}</span></td>
                                                            <td><span style={{ fontWeight: 600 }}>{s.name}</span></td>
                                                            <td style={{ color: 'var(--text-secondary)' }}>Semester {s.semester}</td>
                                                            <td style={{ paddingRight: 20, color: 'var(--text-secondary)' }}>{s.credits}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Add Subject Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Subject" size="sm">
                <form onSubmit={handleCreate} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Subject Details</p>
                        <div className="form-group">
                            <label className="form-label">Subject Name <span className="required">*</span></label>
                            <input
                                className="form-input"
                                placeholder="e.g. Data Structures"
                                value={form.name}
                                onChange={e => upd('name', e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Subject Code <span className="required">*</span></label>
                            <input
                                className="form-input"
                                placeholder="e.g. CS201"
                                value={form.code}
                                onChange={e => upd('code', e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Academic Year <span className="required">*</span></label>
                            <select
                                className="form-input"
                                value={form.academic_year}
                                onChange={e => upd('academic_year', parseInt(e.target.value))}
                                required
                            >
                                <option value={1}>1st Year</option>
                                <option value={2}>2nd Year</option>
                                <option value={3}>3rd Year</option>
                                <option value={4}>4th Year</option>
                            </select>
                        </div>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Semester</label>
                                <select
                                    className="form-input"
                                    value={form.semester}
                                    onChange={e => upd('semester', parseInt(e.target.value))}
                                >
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Credits</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="3"
                                    value={form.credits}
                                    onChange={e => upd('credits', parseInt(e.target.value))}
                                    min={1}
                                    max={6}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-hod">Add Subject</button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
