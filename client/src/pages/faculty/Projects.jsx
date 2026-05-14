import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

const STATUS_STYLES = {
    verified: { bg: 'rgba(22,163,74,0.12)',  color: '#15803D', label: 'Verified'  },
    pending:  { bg: 'rgba(245,158,11,0.12)', color: '#D97706', label: 'Pending'   },
    rejected: { bg: 'rgba(220,38,38,0.1)',   color: '#DC2626', label: 'Rejected'  },
};

const TYPE_ICONS  = { project: '🛠', course: '📚', certification: '🏅' };
const TYPE_LABELS = { project: 'Project', course: 'Course', certification: 'Certification' };

function Toast({ msg, type = 'success', onDone }) {
    useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
    return (
        <div style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
            background: type === 'success' ? '#15803D' : '#DC2626',
            color: 'white', borderRadius: 12, padding: '13px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)', fontSize: '0.875rem', fontWeight: 600,
            animation: 'slideUp 0.25s ease',
        }}>{msg}</div>
    );
}

// Chip-style select for filter dropdowns
function FilterChip({ label, value, options, onChange, color = '#1565C0' }) {
    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                style={{
                    appearance: 'none',
                    padding: '7px 30px 7px 12px',
                    borderRadius: 8,
                    border: value ? `1.5px solid ${color}` : '1.5px solid var(--border)',
                    background: value ? `${color}12` : 'var(--bg-card)',
                    color: value ? color : 'var(--text-secondary)',
                    fontSize: '0.8rem', fontWeight: value ? 700 : 500,
                    cursor: 'pointer', outline: 'none',
                    transition: 'all 0.15s',
                }}
            >
                {options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
            {/* dropdown caret */}
            <span style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                pointerEvents: 'none', fontSize: '0.6rem', color: value ? color : 'var(--text-tertiary)',
            }}>▼</span>
        </div>
    );
}

export default function FacultyProjects() {
    const [projects, setProjects] = useState([]);
    const [meta, setMeta]         = useState([]);   // [{year, section}]
    const [loading, setLoading]   = useState(true);
    const [tab, setTab]           = useState('all'); // status tab
    const [toast, setToast]       = useState(null);

    // Filters
    const [filterYear,    setFilterYear]    = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [filterType,    setFilterType]    = useState('');
    const [search,        setSearch]        = useState('');

    const showToast = (msg, type = 'success') => setToast({ msg, type });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const params = {};
            if (filterYear)    params.year    = filterYear;
            if (filterSection) params.section = filterSection;
            if (filterType)    params.type    = filterType;
            const r = await api.get('/faculty/projects', { params });
            setProjects(r.data.projects || []);
            setMeta(r.data.meta || []);
        } catch { }
        finally { setLoading(false); }
    }, [filterYear, filterSection, filterType]);

    useEffect(() => { load(); }, [load]);

    // Reset section when year changes and current section isn't in new year's list
    useEffect(() => {
        const sectionsForYear = filterYear
            ? [...new Set(meta.filter(m => String(m.year) === filterYear).map(m => m.section))]
            : [];
        if (filterYear && filterSection && !sectionsForYear.includes(filterSection)) {
            setFilterSection('');
        }
    }, [filterYear, meta]);

    const handleVerify = async (p) => {
        try {
            await api.patch(`/faculty/projects/${p.id}/verify`);
            showToast(`✅ "${p.title}" verified!`);
            load();
        } catch (err) { showToast(err.response?.data?.error || 'Error', 'error'); }
    };

    const handleUnverify = async (p) => {
        if (!window.confirm(`Unverify "${p.title}"?`)) return;
        try {
            await api.patch(`/faculty/projects/${p.id}/unverify`);
            showToast(`↩️ "${p.title}" unverified.`, 'error');
            load();
        } catch (err) { showToast(err.response?.data?.error || 'Error', 'error'); }
    };

    const handleReject = async (p) => {
        const reason = window.prompt(`Reason for rejecting "${p.title}" (optional):`);
        if (reason === null) return;
        try {
            await api.patch(`/faculty/projects/${p.id}/reject`, { reason });
            showToast(`"${p.title}" rejected.`, 'error');
            load();
        } catch (err) { showToast(err.response?.data?.error || 'Error', 'error'); }
    };

    const handleDelete = async (p) => {
        if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/faculty/projects/${p.id}`);
            showToast(`🗑️ "${p.title}" deleted.`, 'error');
            load();
        } catch (err) { showToast(err.response?.data?.error || 'Error', 'error'); }
    };

    const clearFilters = () => {
        setFilterYear(''); setFilterSection(''); setFilterType(''); setSearch('');
    };
    const hasFilters = filterYear || filterSection || filterType || search;

    // Year options from meta
    const yearOptions = [
        { value: '', label: 'All Years' },
        ...([...new Set(meta.map(m => m.year))].sort().map(y => ({ value: String(y), label: `Year ${y}` }))),
    ];

    // Section options — filtered by selected year if any
    const availSections = filterYear
        ? [...new Set(meta.filter(m => String(m.year) === filterYear).map(m => m.section))].sort()
        : [...new Set(meta.map(m => m.section))].sort();
    const sectionOptions = [
        { value: '', label: 'All Sections' },
        ...availSections.map(s => ({ value: s, label: `Section ${s}` })),
    ];

    const typeOptions = [
        { value: '',              label: 'All Types'     },
        { value: 'project',       label: '🛠 Project'    },
        { value: 'course',        label: '📚 Course'     },
        { value: 'certification', label: '🏅 Certification' },
    ];

    // Status tab filter (client-side, applied after server results)
    const getStatusKey = (p) => p.is_verified ? 'verified' : (p.status === 'rejected' ? 'rejected' : 'pending');
    const filtered = projects
        .filter(p => tab === 'all' || getStatusKey(p) === tab)
        .filter(p => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (
                p.full_name?.toLowerCase().includes(q) ||
                p.roll_number?.toLowerCase().includes(q) ||
                p.title?.toLowerCase().includes(q)
            );
        });

    const pending  = projects.filter(p => !p.is_verified && p.status !== 'rejected');
    const verified = projects.filter(p => p.is_verified);
    const rejected = projects.filter(p => p.status === 'rejected');

    return (
        <DashboardLayout>
            {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    Student Projects
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Review and verify student-submitted projects, courses and certifications
                </p>
            </div>

            {/* ── Filter bar ─────────────────────────────────────────────── */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
                padding: '14px 16px', marginBottom: 16,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, boxShadow: 'var(--shadow-sm)',
            }}>
                {/* Search */}
                <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Search student, roll no, title…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: '100%', padding: '7px 10px 7px 28px',
                            border: '1.5px solid var(--border)', borderRadius: 8,
                            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                            fontSize: '0.8rem', outline: 'none',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>

                <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

                {/* Year filter */}
                <FilterChip
                    label="Year"
                    value={filterYear}
                    options={yearOptions}
                    onChange={v => { setFilterYear(v); setFilterSection(''); }}
                    color="#1565C0"
                />

                {/* Section filter */}
                <FilterChip
                    label="Section"
                    value={filterSection}
                    options={sectionOptions}
                    onChange={setFilterSection}
                    color="#6A1B9A"
                />

                {/* Type filter */}
                <FilterChip
                    label="Type"
                    value={filterType}
                    options={typeOptions}
                    onChange={setFilterType}
                    color="#0891B2"
                />

                {hasFilters && (
                    <button onClick={clearFilters} style={{
                        padding: '7px 12px', borderRadius: 8,
                        border: '1.5px solid var(--border)',
                        background: 'transparent', color: 'var(--text-secondary)',
                        fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    }}>✕ Clear</button>
                )}

                {/* Active filter chips */}
                <div style={{ flex: 1 }} />
                {filterYear && (
                    <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(21,101,192,0.1)', color: '#1565C0', fontSize: '0.73rem', fontWeight: 700 }}>
                        Year {filterYear}
                    </span>
                )}
                {filterSection && (
                    <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(106,27,154,0.1)', color: '#6A1B9A', fontSize: '0.73rem', fontWeight: 700 }}>
                        Sec {filterSection}
                    </span>
                )}
                {filterType && (
                    <span style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(8,145,178,0.1)', color: '#0891B2', fontSize: '0.73rem', fontWeight: 700 }}>
                        {TYPE_LABELS[filterType] || filterType}
                    </span>
                )}
            </div>

            {/* ── Status tabs ─────────────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
                {[
                    { key: 'all',      label: 'All',      value: projects.length, color: '#6A1B9A', bg: 'rgba(106,27,154,0.07)' },
                    { key: 'pending',  label: 'Pending',  value: pending.length,  color: '#D97706', bg: 'rgba(245,158,11,0.07)' },
                    { key: 'verified', label: 'Verified', value: verified.length, color: '#15803D', bg: 'rgba(22,163,74,0.07)'  },
                    { key: 'rejected', label: 'Rejected', value: rejected.length, color: '#DC2626', bg: 'rgba(220,38,38,0.07)'  },
                ].map(s => (
                    <button key={s.key} onClick={() => setTab(s.key)} style={{
                        padding: '14px 16px', borderRadius: 12,
                        background: tab === s.key ? s.bg : 'var(--bg-card)',
                        border: tab === s.key ? `1.5px solid ${s.color}44` : '1px solid var(--border)',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                    }}>
                        <p style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>{s.label}</p>
                    </button>
                ))}
            </div>

            {/* ── Results ─────────────────────────────────────────────────── */}
            {loading ? (
                <LoadingSpinner />
            ) : filtered.length === 0 ? (
                <div style={{ borderRadius: 14, padding: '48px 24px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>📭</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        {hasFilters ? 'No projects match your filters' : 'No projects in this category'}
                    </p>
                    {hasFilters && (
                        <button onClick={clearFilters} style={{ marginTop: 12, padding: '7px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>Clear filters</button>
                    )}
                </div>
            ) : (
                <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                    {/* result count */}
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                            {filtered.length} project{filtered.length !== 1 ? 's' : ''} found
                        </span>
                        {(filterYear || filterSection) && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                {filterYear ? `• Year ${filterYear}` : ''}{filterSection ? ` • Sec ${filterSection}` : ''}
                            </span>
                        )}
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                {['Student', 'Roll No', 'Class', 'Title', 'Type', 'Link', 'Status', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(p => {
                                const sk = getStatusKey(p);
                                const ss = STATUS_STYLES[sk];
                                return (
                                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.1s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{p.full_name}</td>
                                        <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{p.roll_number}</td>
                                        {/* Class column — Year + Section */}
                                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ padding: '2px 7px', borderRadius: 6, background: 'rgba(21,101,192,0.1)', color: '#1565C0', fontSize: '0.7rem', fontWeight: 700 }}>
                                                    Y{p.year}
                                                </span>
                                                <span style={{ padding: '2px 7px', borderRadius: 6, background: 'rgba(106,27,154,0.1)', color: '#6A1B9A', fontSize: '0.7rem', fontWeight: 700 }}>
                                                    {p.section}
                                                </span>
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                                                {TYPE_ICONS[p.type] || '📁'} {p.title}
                                            </div>
                                            {p.description && (
                                                <div style={{ fontSize: '0.73rem', color: 'var(--text-tertiary)', marginTop: 2, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {p.description}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 14px', fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                            {TYPE_ICONS[p.type]} {TYPE_LABELS[p.type] || p.type}
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            {p.project_link ? (
                                                <a href={p.project_link} target="_blank" rel="noopener noreferrer"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: 'rgba(106,27,154,0.09)', color: '#6A1B9A', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}>
                                                    🔗 Open
                                                </a>
                                            ) : (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600, background: ss.bg, color: ss.color, whiteSpace: 'nowrap' }}>
                                                {ss.label}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 14px' }}>
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                {!p.is_verified && p.status !== 'rejected' && (
                                                    <>
                                                        <button onClick={() => handleVerify(p)}
                                                            style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: '#15803D', color: 'white', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                            ✓ Verify
                                                        </button>
                                                        <button onClick={() => handleReject(p)}
                                                            style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #FCA5A5', background: 'rgba(220,38,38,0.06)', color: '#DC2626', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                            ✕ Reject
                                                        </button>
                                                    </>
                                                )}
                                                {p.is_verified && (
                                                    <button onClick={() => handleUnverify(p)}
                                                        style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                        ↩ Unverify
                                                    </button>
                                                )}
                                                {p.status === 'rejected' && (
                                                    <button onClick={() => handleVerify(p)}
                                                        style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: '#15803D', color: 'white', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                        ✓ Verify Instead
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(p)}
                                                    style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #FCA5A5', background: 'rgba(220,38,38,0.06)', color: '#DC2626', cursor: 'pointer', fontSize: '0.73rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                                    🗑 Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </DashboardLayout>
    );
}
