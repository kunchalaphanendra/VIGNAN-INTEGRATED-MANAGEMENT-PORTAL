import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import { HiOutlineCheckCircle, HiOutlinePencil, HiOutlineTrash, HiOutlinePlus,
         HiOutlineExternalLink, HiOutlineChevronDown, HiOutlineChevronUp, HiOutlineLockClosed } from 'react-icons/hi';

const STATUS_COLORS = {
    Active:   { color: '#16A34A', bg: 'rgba(22,163,74,0.1)'   },
    Closed:   { color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
    Upcoming: { color: '#1565C0', bg: 'rgba(21,101,192,0.1)'  },
};

const ALL_YEARS = [1, 2, 3, 4];

const emptyForm = {
    company: '', role: '', description: '', min_cgpa: 6.0,
    eligible_years: [1, 2, 3, 4],
    openings: 1, open_date: '', close_date: '',
    apply_link: '', contact_email: '', status: 'Active',
};

function Toast({ msg, type = 'success', onDone }) {
    useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
    return (
        <div style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
            background: type === 'success' ? '#16A34A' : '#DC2626',
            color: 'white', borderRadius: 12, padding: '13px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: '0.875rem', fontWeight: 600,
        }}><HiOutlineCheckCircle size={18} />{msg}</div>
    );
}

function isClosingSoon(closeDate) {
    if (!closeDate) return false;
    const diff = (new Date(closeDate) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
}

// Card for principal-posted jobs (read-only for HOD)
function ReadOnlyCard({ job }) {
    const [expanded, setExpanded] = useState(false);
    const sc = STATUS_COLORS[job.status] || STATUS_COLORS.Active;
    const closingSoon = isClosingSoon(job.close_date) && job.status === 'Active';
    const years = job.eligible_years || [];

    return (
        <div style={{ borderRadius: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', opacity: 0.88 }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg, #B71C1C, #E53935)' }} />
            <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{job.company}</h3>
                            <span title="Posted by Principal" style={{ display:'flex', alignItems:'center', gap:3, fontSize:'0.68rem', color:'#B71C1C', fontWeight:700, background:'rgba(183,28,28,0.08)', padding:'2px 7px', borderRadius:20 }}>
                                <HiOutlineLockClosed size={10} /> Principal
                            </span>
                        </div>
                        <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: 2 }}>{job.role}</p>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 100, fontSize: '0.68rem', fontWeight: 700, background: sc.bg, color: sc.color, flexShrink: 0 }}>{job.status}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(26,60,110,0.08)', color: '#1A3C6E' }}>
                        CGPA ≥ {job.min_cgpa} | Year {years.join(', ')} | {job.openings} Opening{job.openings > 1 ? 's' : ''}
                    </span>
                </div>
                {job.close_date && (
                    <p style={{ fontSize: '0.75rem', color: closingSoon ? '#DC2626' : 'var(--text-tertiary)', fontWeight: closingSoon ? 700 : 400, marginBottom: 8 }}>
                        {closingSoon ? '🔴 Closing Soon · ' : '📅 Closes: '}{job.close_date}
                    </p>
                )}
                <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: 0, marginBottom: expanded ? 8 : 0 }}>
                    {expanded ? <HiOutlineChevronUp size={13} /> : <HiOutlineChevronDown size={13} />}
                    {expanded ? 'Hide description' : 'View description'}
                </button>
                {expanded && job.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>{job.description}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {job.apply_link && (
                        <a href={job.apply_link} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: job.status === 'Active' ? 'linear-gradient(135deg,#1A3C6E,#2563EB)' : 'var(--bg-secondary)', color: job.status === 'Active' ? 'white' : 'var(--text-tertiary)', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>
                            <HiOutlineExternalLink size={13} /> Apply / View Details
                        </a>
                    )}
                    {job.contact_email && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', alignSelf: 'center' }}>📧 {job.contact_email}</span>}
                </div>
            </div>
        </div>
    );
}

// Card for HOD-posted jobs (editable)
function HodJobCard({ job, onEdit, onDelete }) {
    const [expanded, setExpanded] = useState(false);
    const sc = STATUS_COLORS[job.status] || STATUS_COLORS.Active;
    const closingSoon = isClosingSoon(job.close_date) && job.status === 'Active';
    const years = job.eligible_years || [];

    return (
        <div style={{ borderRadius: 14, background: 'var(--bg-card)', border: '1.5px solid rgba(46,125,50,0.3)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <div style={{ height: 4, background: 'linear-gradient(90deg, #2E7D32, #4CAF50)' }} />
            <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{job.company}</h3>
                            <span style={{ fontSize: '0.68rem', color: '#2E7D32', fontWeight: 700, background: 'rgba(46,125,50,0.1)', padding: '2px 7px', borderRadius: 20 }}>
                                My Post
                            </span>
                        </div>
                        <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginTop: 2 }}>{job.role}</p>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 100, fontSize: '0.68rem', fontWeight: 700, background: sc.bg, color: sc.color, flexShrink: 0 }}>{job.status}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(46,125,50,0.08)', color: '#2E7D32' }}>
                        CGPA ≥ {job.min_cgpa} | Year {years.join(', ')} | {job.openings} Opening{job.openings > 1 ? 's' : ''}
                    </span>
                    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(107,114,128,0.08)', color: '#6B7280' }}>
                        Dept Only
                    </span>
                </div>
                {job.close_date && (
                    <p style={{ fontSize: '0.75rem', color: closingSoon ? '#DC2626' : 'var(--text-tertiary)', fontWeight: closingSoon ? 700 : 400, marginBottom: 8 }}>
                        {closingSoon ? '🔴 Closing Soon · ' : '📅 Closes: '}{job.close_date}
                    </p>
                )}
                <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: 0, marginBottom: expanded ? 8 : 0 }}>
                    {expanded ? <HiOutlineChevronUp size={13} /> : <HiOutlineChevronDown size={13} />}
                    {expanded ? 'Hide description' : 'View description'}
                </button>
                {expanded && job.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>{job.description}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {job.apply_link && (
                        <a href={job.apply_link} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, background: job.status === 'Active' ? 'linear-gradient(135deg,#1A3C6E,#2563EB)' : 'var(--bg-secondary)', color: job.status === 'Active' ? 'white' : 'var(--text-tertiary)', fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none' }}>
                            <HiOutlineExternalLink size={13} /> Apply / View Details
                        </a>
                    )}
                    {/* Edit & Delete only for HOD's own jobs */}
                    <button onClick={() => onEdit(job)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                        <HiOutlinePencil size={13} /> Edit
                    </button>
                    <button onClick={() => onDelete(job)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8, border: '1.5px solid #FCA5A5', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                        <HiOutlineTrash size={13} /> Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function HodPlacements() {
    const [jobs, setJobs]               = useState([]);
    const [loading, setLoading]         = useState(true);
    const [tab, setTab]                 = useState('active');
    const [showModal, setShowModal]     = useState(false);
    const [editJob, setEditJob]         = useState(null);
    const [form, setForm]               = useState(emptyForm);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [saving, setSaving]           = useState(false);
    const [deleting, setDeleting]       = useState(false);
    const [toast, setToast]             = useState(null);

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            setLoading(true);
            const r = await api.get('/hod/placements');
            setJobs(r.data.jobs || []);
        } catch { setJobs([]); }
        finally { setLoading(false); }
    };

    const openCreate = () => { setEditJob(null); setForm(emptyForm); setShowModal(true); };
    const openEdit   = (j) => {
        setEditJob(j);
        setForm({
            company: j.company, role: j.role, description: j.description || '',
            min_cgpa: j.min_cgpa, eligible_years: j.eligible_years || [1,2,3,4],
            openings: j.openings, open_date: j.open_date || '',
            close_date: j.close_date || '', apply_link: j.apply_link || '',
            contact_email: j.contact_email || '', status: j.status,
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editJob) {
                await api.put(`/hod/placements/${editJob.id}`, form);
                setToast({ msg: 'Job posting updated!', type: 'success' });
            } else {
                await api.post('/hod/placements', form);
                setToast({ msg: 'Job posted for your department!', type: 'success' });
            }
            setShowModal(false);
            load();
        } catch (err) {
            setToast({ msg: err.response?.data?.error || 'Failed to save', type: 'error' });
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/hod/placements/${deleteTarget.id}`);
            setDeleteTarget(null);
            setToast({ msg: 'Job posting deleted.', type: 'error' });
            load();
        } catch (err) {
            setToast({ msg: err.response?.data?.error || 'Delete failed', type: 'error' });
        } finally { setDeleting(false); }
    };

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const toggleYear = (y) => setForm(f => ({
        ...f, eligible_years: f.eligible_years.includes(y)
            ? f.eligible_years.filter(x => x !== y)
            : [...f.eligible_years, y]
    }));

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    // Split: HOD's own vs principal's
    const myJobs = jobs.filter(j => j.posted_by_role === 'hod');
    const principalJobs = jobs.filter(j => j.posted_by_role !== 'hod');

    const activeJobs = jobs.filter(j => j.status === 'Active' || j.status === 'Upcoming');
    const closedJobs = jobs.filter(j => j.status === 'Closed');
    const displayed  = tab === 'active' ? activeJobs : closedJobs;
    const displayedMy = displayed.filter(j => j.posted_by_role === 'hod');
    const displayedPrincipal = displayed.filter(j => j.posted_by_role !== 'hod');

    return (
        <DashboardLayout>
            <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity:0; } to { transform: translateY(0); opacity:1; } }`}</style>
            {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>💼 Placements</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Post department-level opportunities · Principal's jobs are visible to all students
                    </p>
                </div>
                <button onClick={openCreate} className="btn btn-hod" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <HiOutlinePlus size={16} /> Post New Job
                </button>
            </div>

            {/* Summary chips */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                    { key: 'active', label: `Active / Upcoming (${activeJobs.length})` },
                    { key: 'closed', label: `Closed (${closedJobs.length})` },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        padding: '7px 18px', borderRadius: 100, cursor: 'pointer',
                        fontSize: '0.8rem', fontWeight: tab === t.key ? 700 : 500,
                        background: tab === t.key ? '#2E7D32' : 'var(--bg-secondary)',
                        color: tab === t.key ? 'white' : 'var(--text-secondary)',
                        border: tab === t.key ? 'none' : '1px solid var(--border)',
                        transition: 'all 0.2s',
                    }}>{t.label}</button>
                ))}
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'My Posts', value: myJobs.length, color: '#2E7D32', bg: 'rgba(46,125,50,0.07)' },
                    { label: 'From Principal', value: principalJobs.length, color: '#B71C1C', bg: 'rgba(183,28,28,0.07)' },
                    { label: 'Total Active', value: activeJobs.length, color: '#1565C0', bg: 'rgba(21,101,192,0.07)' },
                ].map(s => (
                    <div key={s.label} style={{ padding: '14px 16px', borderRadius: 12, background: s.bg, border: `1.5px solid ${s.color}22` }}>
                        <p style={{ fontSize: '1.5rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Job cards */}
            {displayed.length === 0 ? (
                <div style={{ borderRadius: 14, padding: '48px 24px', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>{tab === 'active' ? '📭' : '🗃️'}</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        {tab === 'active' ? 'No active job postings.' : 'No closed postings.'}
                    </p>
                    {tab === 'active' && (
                        <button onClick={openCreate} style={{ marginTop: 14, padding: '8px 20px', borderRadius: 9, border: 'none', background: '#2E7D32', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.83rem' }}>
                            + Post First Job
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                    {/* My dept posts */}
                    {displayedMy.length > 0 && (
                        <div>
                            <p style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2E7D32', marginBottom: 12 }}>
                                📌 My Department Posts
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                                {displayedMy.map(j => (
                                    <HodJobCard key={j.id} job={j} onEdit={openEdit} onDelete={setDeleteTarget} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Principal's institution-wide posts */}
                    {displayedPrincipal.length > 0 && (
                        <div>
                            <p style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#B71C1C', marginBottom: 12 }}>
                                🏫 Institution-Wide Posts (by Principal)
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
                                {displayedPrincipal.map(j => (
                                    <ReadOnlyCard key={j.id} job={j} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Create / Edit Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)}
                title={editJob ? 'Edit Job Posting' : 'Post New Job — Your Department'}
                size="lg">
                <form onSubmit={handleSave} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Company & Role</p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Company Name <span className="required">*</span></label>
                                <input className="form-input" value={form.company} onChange={e => upd('company', e.target.value)} required placeholder="e.g. Infosys" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Job Role / Designation <span className="required">*</span></label>
                                <input className="form-input" value={form.role} onChange={e => upd('role', e.target.value)} required placeholder="e.g. Software Engineer" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Job Description</label>
                            <textarea className="form-input" rows={3} value={form.description} onChange={e => upd('description', e.target.value)} placeholder="Describe the role..." style={{ resize: 'vertical' }} />
                        </div>
                    </div>

                    <div className="modal-section">
                        <p className="modal-section-title">Eligibility</p>
                        <div className="form-row form-row-3">
                            <div className="form-group">
                                <label className="form-label">Min CGPA</label>
                                <input type="number" step="0.1" min="0" max="10" className="form-input" value={form.min_cgpa} onChange={e => upd('min_cgpa', parseFloat(e.target.value))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Number of Openings</label>
                                <input type="number" min="1" className="form-input" value={form.openings} onChange={e => upd('openings', parseInt(e.target.value))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-input" value={form.status} onChange={e => upd('status', e.target.value)}>
                                    <option value="Active">Active</option>
                                    <option value="Upcoming">Upcoming</option>
                                    <option value="Closed">Closed</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Eligible Years</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                {ALL_YEARS.map(y => (
                                    <button type="button" key={y} onClick={() => toggleYear(y)}
                                        style={{ padding: '5px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                            background: form.eligible_years.includes(y) ? '#2E7D32' : 'var(--bg-secondary)',
                                            color: form.eligible_years.includes(y) ? 'white' : 'var(--text-secondary)',
                                            border: `1.5px solid ${form.eligible_years.includes(y) ? '#2E7D32' : 'var(--border)'}` }}>
                                        Year {y}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4, padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                            ℹ️ This job will be visible only to students in <strong>your department</strong>.
                        </p>
                    </div>

                    <div className="modal-section">
                        <p className="modal-section-title">Dates & Application</p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Opening Date</label>
                                <input type="date" className="form-input" value={form.open_date} onChange={e => upd('open_date', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Closing Date</label>
                                <input type="date" className="form-input" value={form.close_date} onChange={e => upd('close_date', e.target.value)} />
                            </div>
                        </div>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Apply Link (URL)</label>
                                <input className="form-input" value={form.apply_link} onChange={e => upd('apply_link', e.target.value)} placeholder="https://..." />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Contact Email</label>
                                <input type="email" className="form-input" value={form.contact_email} onChange={e => upd('contact_email', e.target.value)} placeholder="hr@company.com" />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-hod" disabled={saving}>
                            {saving ? 'Saving...' : editJob ? 'Update Job' : 'Post Job'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete confirmation */}
            <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Job Posting" size="sm">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center' }}>
                        Delete <strong>{deleteTarget?.company} — {deleteTarget?.role}</strong>? This cannot be undone.
                    </p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: deleting ? '#9CA3AF' : '#DC2626', color: 'white', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer' }}>
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
