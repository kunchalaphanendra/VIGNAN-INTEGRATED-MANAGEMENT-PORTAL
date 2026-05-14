import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import { HiOutlineExternalLink, HiOutlineChevronDown, HiOutlineChevronUp, HiOutlineUser } from 'react-icons/hi';

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

function isEligible(job, profile) {
    if (!profile || !profile.dept_code) return null; // unknown
    const depts = job.eligible_departments || [];
    const years = job.eligible_years || [];
    const passesYear = years.length === 0 || years.includes(Number(profile.year));
    const passesDept = depts.length === 0 || depts.includes(profile.dept_code);
    const passesCGPA = !job.min_cgpa || Number(profile.cgpa) >= Number(job.min_cgpa);
    return passesYear && passesDept && passesCGPA;
}

function JobCard({ job, profile }) {
    const [expanded, setExpanded] = useState(false);
    const eligible = isEligible(job, profile);
    const sc = STATUS_COLORS[job.status] || STATUS_COLORS.Active;
    const closingSoon = isClosingSoon(job.close_date) && job.status === 'Active';
    const depts = job.eligible_departments || [];
    const years = job.eligible_years || [];

    return (
        <div style={{ borderRadius: 14, background: 'var(--bg-card)', border: `1.5px solid ${eligible === false ? '#FCA5A5' : 'var(--border)'}`, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ height: 4, background: eligible === false ? 'linear-gradient(90deg,#DC2626,#F87171)' : 'linear-gradient(90deg, #6A1B9A, #9C27B0)' }} />
            <div style={{ padding: '18px 22px' }}>
                {/* Eligibility banner */}
                {eligible === false && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(220,38,38,0.07)', border: '1px solid #FCA5A5', fontSize: '0.78rem', color: '#B91C1C', fontWeight: 600 }}>
                        ⚠ You may not be eligible — check CGPA, year, or department requirements
                    </div>
                )}
                {eligible === true && (
                    <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(22,163,74,0.07)', border: '1px solid #86EFAC', fontSize: '0.78rem', color: '#15803D', fontWeight: 600 }}>
                        ✅ You appear eligible based on your profile
                    </div>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                    <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{job.company}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>{job.role}</p>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 700, background: sc.bg, color: sc.color, flexShrink: 0 }}>{job.status}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(106,27,154,0.08)', color: '#6A1B9A' }}>
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
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
                    {job.apply_link ? (
                        <a href={eligible === false ? '#' : job.apply_link} target="_blank" rel="noopener noreferrer"
                            onClick={eligible === false ? e => e.preventDefault() : undefined}
                            title={eligible === false ? 'You are not eligible for this posting' : ''}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, background: eligible === false || job.status !== 'Active' ? 'var(--bg-secondary)' : 'linear-gradient(135deg, #6A1B9A, #9C27B0)', color: eligible === false || job.status !== 'Active' ? 'var(--text-tertiary)' : 'white', fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none', cursor: eligible === false || job.status !== 'Active' ? 'not-allowed' : 'pointer' }}>
                            <HiOutlineExternalLink size={13} /> {eligible === false ? 'Not Eligible' : 'Apply / View Details'}
                        </a>
                    ) : null}
                    {job.contact_email && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>📧 {job.contact_email}</span>}
                </div>
            </div>
        </div>
    );
}

export default function StudentPlacements() {
    const [jobs, setJobs] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('active');
    const [filterDept, setFilterDept] = useState('');
    const [filterYear, setFilterYear] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const r = await api.get('/student/placements');
                setJobs(r.data.jobs || []);
                setProfile(r.data.student_profile || null);
            } catch { setJobs([]); } finally { setLoading(false); }
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
            {/* Profile bar */}
            {profile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 12, background: 'rgba(106,27,154,0.06)', border: '1.5px solid rgba(106,27,154,0.14)', marginBottom: 20 }}>
                    <HiOutlineUser size={20} style={{ color: '#6A1B9A', flexShrink: 0 }} />
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexWrap: 'wrap', gap: '6px 20px' }}>
                        <span><strong>Dept:</strong> {profile.dept_code || '—'}</span>
                        <span><strong>Year:</strong> {profile.year || '—'}</span>
                        <span><strong>CGPA:</strong> {Number(profile.cgpa).toFixed(2)}</span>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#6A1B9A', fontWeight: 600 }}>Your profile is used to check eligibility</span>
                </div>
            )}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>💼 Placements</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Job opportunities — eligibility checked against your profile</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', borderRadius: 100, background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: 3 }}>
                    {[{ key: 'active', label: `Active / Upcoming (${active.length})` }, { key: 'closed', label: `Closed (${closed.length})` }].map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '6px 16px', borderRadius: 100, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: tab === t.key ? 700 : 500, background: tab === t.key ? '#6A1B9A' : 'transparent', color: tab === t.key ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s' }}>{t.label}</button>
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
                {displayed.map(j => <JobCard key={j.id} job={j} profile={profile} />)}
                {displayed.length === 0 && (
                    <div style={{ gridColumn: '1/-1', borderRadius: 14, padding: '48px 24px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No job postings found</p>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
