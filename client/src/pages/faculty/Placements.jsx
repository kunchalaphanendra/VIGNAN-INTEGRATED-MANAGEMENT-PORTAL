import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import { HiOutlineExternalLink, HiOutlineChevronDown, HiOutlineChevronUp } from 'react-icons/hi';

const STATUS_COLORS = {
    Active: { color: '#16A34A', bg: 'rgba(22,163,74,0.1)' },
    Closed: { color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
    Upcoming: { color: '#1565C0', bg: 'rgba(21,101,192,0.1)' },
};

function isClosingSoon(closeDate) {
    if (!closeDate) return false;
    const diff = (new Date(closeDate) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
}

function JobCard({ job }) {
    const [expanded, setExpanded] = useState(false);
    const sc = STATUS_COLORS[job.status] || STATUS_COLORS.Active;
    const closingSoon = isClosingSoon(job.close_date) && job.status === 'Active';
    const depts = job.eligible_departments || [];
    const years = job.eligible_years || [];

    return (
        <div style={{ borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg, #1565C0, #22C55E)' }} />
            <div style={{ padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                    <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{job.company}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>{job.role}</p>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 700, background: sc.bg, color: sc.color, flexShrink: 0 }}>{job.status}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(21,101,192,0.08)', color: '#1565C0' }}>
                        CGPA ≥ {job.min_cgpa} | {depts.join(', ')} | Year {years.join(', ')}
                    </span>
                    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(107,114,128,0.08)', color: '#6B7280' }}>
                        {job.openings} Opening{job.openings > 1 ? 's' : ''}
                    </span>
                </div>
                {job.close_date && (
                    <p style={{ fontSize: '0.75rem', color: closingSoon ? '#DC2626' : 'var(--text-tertiary)', fontWeight: closingSoon ? 700 : 400, marginBottom: 10 }}>
                        {closingSoon ? '🔴 Closing Soon · ' : '📅 Closes: '}{job.close_date}
                    </p>
                )}
                <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: 0, marginBottom: expanded ? 10 : 0 }}>
                    {expanded ? <HiOutlineChevronUp size={13} /> : <HiOutlineChevronDown size={13} />}
                    {expanded ? 'Hide description' : 'View description'}
                </button>
                {expanded && job.description && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>{job.description}</p>}
                {job.apply_link && (
                    <a href={job.apply_link} target="_blank" rel="noopener noreferrer"
                        style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, background: job.status === 'Active' ? 'linear-gradient(135deg, #1565C0, #2563EB)' : 'var(--bg-secondary)', color: job.status === 'Active' ? 'white' : 'var(--text-tertiary)', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', pointerEvents: job.status !== 'Active' ? 'none' : 'auto' }}>
                        <HiOutlineExternalLink size={13} /> Apply / View Details
                    </a>
                )}
            </div>
        </div>
    );
}

export default function FacultyPlacements() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('active');
    const [filterDept, setFilterDept] = useState('');
    const [filterYear, setFilterYear] = useState('');

    useEffect(() => {
        (async () => {
            try { const r = await api.get('/faculty/placements'); setJobs(r.data.jobs || []); }
            catch { setJobs([]); } finally { setLoading(false); }
        })();
    }, []);

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    const active = jobs.filter(j => j.status === 'Active' || j.status === 'Upcoming');
    const closed = jobs.filter(j => j.status === 'Closed');
    const uniqueDepts = [...new Set(jobs.flatMap(j => j.eligible_departments || []))];

    const filterFn = (list) => list.filter(j => {
        if (filterDept && !(j.eligible_departments || []).includes(filterDept)) return false;
        if (filterYear && !(j.eligible_years || []).includes(parseInt(filterYear))) return false;
        return true;
    });

    const displayed = filterFn(tab === 'active' ? active : closed);

    return (
        <DashboardLayout>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>💼 Placements</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Campus recruitment and job opportunities</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', borderRadius: 100, background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: 3 }}>
                    {[{ key: 'active', label: `Active / Upcoming (${active.length})` }, { key: 'closed', label: `Closed (${closed.length})` }].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '6px 16px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: tab === t.key ? 700 : 500, background: tab === t.key ? '#1565C0' : 'transparent', color: tab === t.key ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s' }}>{t.label}</button>
                    ))}
                </div>
                <select className="form-input" value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ height: 36, width: 140, fontSize: '0.82rem' }}>
                    <option value="">All Depts</option>
                    {uniqueDepts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className="form-input" value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ height: 36, width: 120, fontSize: '0.82rem' }}>
                    <option value="">All Years</option>
                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>
                {(filterDept || filterYear) && <button onClick={() => { setFilterDept(''); setFilterYear(''); }} style={{ fontSize: '0.78rem', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>✕ Clear</button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 16 }}>
                {displayed.map(j => <JobCard key={j.id} job={j} />)}
                {displayed.length === 0 && (
                    <div style={{ gridColumn: '1/-1', borderRadius: 14, padding: '48px 24px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No job postings found</p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
