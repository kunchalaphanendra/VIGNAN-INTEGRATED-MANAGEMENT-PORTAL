import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import { HiOutlineCheckCircle, HiOutlinePencil, HiOutlineTrash, HiOutlinePlus } from 'react-icons/hi';

const STATUS_COLORS = {
    Active: { color: '#16A34A', bg: 'rgba(22,163,74,0.1)' },
    Closed: { color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
    Upcoming: { color: '#1565C0', bg: 'rgba(21,101,192,0.1)' },
};


const ALL_YEARS = [1, 2, 3, 4];

const emptyForm = {
    company: '', role: '', description: '', min_cgpa: 6.0,
    eligible_years: [], eligible_departments: [], openings: 1,
    open_date: '', close_date: '', apply_link: '', contact_email: '', status: 'Active',
};

function Toast({ msg, type = 'success', onDone }) {
    useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
    const bg = type === 'success' ? '#16A34A' : '#DC2626';
    return (
        <div style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
            background: bg, color: 'white', borderRadius: 12,
            padding: '13px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: '0.875rem', fontWeight: 600, animation: 'slideUp 0.3s ease',
        }}><HiOutlineCheckCircle size={18} />{msg}</div>
    );
}

export default function PrincipalPlacements() {
    const [jobs, setJobs] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editJob, setEditJob] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => { load(); loadDepartments(); }, []);

    const loadDepartments = async () => {
        try {
            const r = await api.get('/principal/departments');
            setDepartments(r.data.departments || []);
        } catch { setDepartments([]); }
    };

    const load = async () => {
        try {
            setLoading(true);
            const r = await api.get('/principal/placements');
            setJobs(r.data.jobs || []);
        } catch { setJobs([]); }
        finally { setLoading(false); }
    };

    const openCreate = () => { setEditJob(null); setForm(emptyForm); setShowModal(true); };
    const openEdit = (j) => {
        setEditJob(j);
        setForm({
            company: j.company, role: j.role, description: j.description || '',
            min_cgpa: j.min_cgpa, eligible_years: j.eligible_years || [],
            eligible_departments: j.eligible_departments || [],
            openings: j.openings, open_date: j.open_date || '', close_date: j.close_date || '',
            apply_link: j.apply_link || '', contact_email: j.contact_email || '', status: j.status,
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editJob) {
                await api.put(`/principal/placements/${editJob.id}`, form);
                setToast('Job posting updated!');
            } else {
                await api.post('/principal/placements', form);
                setToast('Job posting created!');
            }
            setShowModal(false);
            load();
        } catch (err) {
            setToast(err.response?.data?.error || 'Failed to save');
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/principal/placements/${deleteTarget.id}`);
            setDeleteTarget(null);
            setToast('Job posting deleted.');
            load();
        } catch (err) {
            setToast(err.response?.data?.error || 'Delete failed');
        } finally { setDeleting(false); }
    };

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const toggleArr = (k, val) => setForm(f => ({
        ...f, [k]: f[k].includes(val) ? f[k].filter(x => x !== val) : [...f[k], val]
    }));

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
            {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>💼 Placements</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Manage and publish job opportunities for students</p>
                </div>
                <button onClick={openCreate} className="btn btn-principal" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <HiOutlinePlus size={16} /> Post New Job
                </button>
            </div>

            <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <table className="data-table">
                    <thead><tr><th>Company</th><th>Role</th><th>Eligibility</th><th>Openings</th><th>Close Date</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        {jobs.map(j => {
                            const sc = STATUS_COLORS[j.status] || STATUS_COLORS.Active;
                            return (
                                <tr key={j.id}>
                                    <td style={{ fontWeight: 700 }}>{j.company}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{j.role}</td>
                                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                        CGPA ≥ {j.min_cgpa} | {(j.eligible_departments || []).join(', ')} | Year {(j.eligible_years || []).join(',')}
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{j.openings}</td>
                                    <td style={{ fontSize: '0.82rem' }}>{j.close_date || '—'}</td>
                                    <td><span style={{ padding: '3px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: sc.bg, color: sc.color }}>{j.status}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => openEdit(j)} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
                                                <HiOutlinePencil size={13} /> Edit
                                            </button>
                                            <button onClick={() => setDeleteTarget(j)} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #FCA5A5', background: 'rgba(220,38,38,0.06)', color: '#DC2626', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
                                                <HiOutlineTrash size={13} /> Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {jobs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--text-tertiary)' }}>No job postings yet — click "Post New Job" to add one</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editJob ? 'Edit Job Posting' : 'Post New Job'} size="lg">
                <form onSubmit={handleSave} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Company & Role</p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Company Name <span className="required">*</span></label>
                                <input className="form-input" value={form.company} onChange={e => upd('company', e.target.value)} required placeholder="e.g. TCS" />
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
                                    <option value="Closed">Closed</option>
                                    <option value="Upcoming">Upcoming</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Eligible Years</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                {ALL_YEARS.map(y => (
                                    <button type="button" key={y} onClick={() => toggleArr('eligible_years', y)}
                                        style={{ padding: '5px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: form.eligible_years.includes(y) ? '#1A3C6E' : 'var(--bg-secondary)', color: form.eligible_years.includes(y) ? 'white' : 'var(--text-secondary)', border: `1.5px solid ${form.eligible_years.includes(y) ? '#1A3C6E' : 'var(--border)'}` }}>
                                        Year {y}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Eligible Departments</label>
                            {departments.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 6 }}>No departments found. Add departments first.</p>
                            ) : (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                    {departments.map(dept => (
                                        <button
                                            type="button"
                                            key={dept.code}
                                            onClick={() => toggleArr('eligible_departments', dept.code)}
                                            title={dept.name}
                                            style={{
                                                padding: '5px 14px', borderRadius: 8, fontSize: '0.8rem',
                                                fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                                background: form.eligible_departments.includes(dept.code) ? '#1A3C6E' : 'var(--bg-secondary)',
                                                color: form.eligible_departments.includes(dept.code) ? 'white' : 'var(--text-secondary)',
                                                border: `1.5px solid ${form.eligible_departments.includes(dept.code) ? '#1A3C6E' : 'var(--border)'}`,
                                            }}
                                        >
                                            {dept.code}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
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
                        <button type="submit" className="btn btn-principal" disabled={saving}>{saving ? 'Saving...' : editJob ? 'Update Job' : 'Post Job'}</button>
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
