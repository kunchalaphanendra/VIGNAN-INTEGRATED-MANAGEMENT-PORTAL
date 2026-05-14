import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

const STATUS_STYLES = {
    verified:  { bg: 'rgba(22,163,74,0.12)',  color: '#15803D', label: 'Verified',  icon: '✓' },
    pending:   { bg: 'rgba(245,158,11,0.12)', color: '#D97706', label: 'Pending',   icon: '⏳' },
    rejected:  { bg: 'rgba(220,38,38,0.1)',   color: '#DC2626', label: 'Rejected',  icon: '✕' },
};

function StatusBadge({ status }) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
    return (
        <span style={{
            padding: '3px 10px', borderRadius: 100, fontSize: '0.72rem',
            fontWeight: 700, background: s.bg, color: s.color,
            display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
            {s.icon} {s.label}
        </span>
    );
}

const TYPE_ICONS = { project: '🛠', course: '📚', certification: '🏅' };

export default function StudentProjects() {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        title: '', description: '', type: 'project',
        platform: '', completed_date: '', project_link: '',
    });

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const r = await api.get('/student/projects');
            setProjects(r.data.projects || []);
        } catch { }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/student/projects', form);
            setShowModal(false);
            setForm({ title: '', description: '', type: 'project', platform: '', completed_date: '', project_link: '' });
            load();
        } catch (err) { alert(err.response?.data?.error || 'Error submitting project'); }
    };

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    const verified = projects.filter(p => p.is_verified);
    const pending  = projects.filter(p => !p.is_verified && p.status !== 'rejected');
    const rejected = projects.filter(p => p.status === 'rejected');

    return (
        <DashboardLayout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                        My Projects & Courses
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Submit and track your projects, courses, and certifications
                    </p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-student">+ Submit New</button>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'Total',    value: projects.length, color: '#6A1B9A', bg: 'rgba(106,27,154,0.07)' },
                    { label: 'Verified', value: verified.length, color: '#15803D', bg: 'rgba(22,163,74,0.07)' },
                    { label: 'Pending',  value: pending.length,  color: '#D97706', bg: 'rgba(245,158,11,0.07)' },
                    { label: 'Rejected', value: rejected.length, color: '#DC2626', bg: 'rgba(220,38,38,0.07)' },
                ].map(stat => (
                    <div key={stat.label} style={{
                        padding: '16px 18px', borderRadius: 12, background: stat.bg,
                        border: `1px solid ${stat.color}22`,
                    }}>
                        <p style={{ fontSize: '1.6rem', fontWeight: 900, color: stat.color }}>{stat.value}</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Projects list */}
            {projects.length === 0 ? (
                <div style={{
                    borderRadius: 14, padding: '48px 24px', textAlign: 'center',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🗂️</div>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No projects submitted yet</p>
                    <button onClick={() => setShowModal(true)} className="btn btn-student" style={{ marginTop: 16 }}>
                        Submit Your First Project
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {projects.map(p => {
                        const statusKey = p.is_verified ? 'verified' : (p.status === 'rejected' ? 'rejected' : 'pending');
                        const s = STATUS_STYLES[statusKey];
                        return (
                            <div key={p.id} style={{
                                borderRadius: 12, background: 'var(--bg-card)',
                                border: `1.5px solid ${p.is_verified ? 'rgba(22,163,74,0.25)' : 'var(--border)'}`,
                                boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
                            }}>
                                <div style={{ height: 3, background: s.color }} />
                                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <span style={{ fontSize: '1.2rem' }}>{TYPE_ICONS[p.type] || '📁'}</span>
                                            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{p.title}</p>
                                        </div>
                                        {p.description && (
                                            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
                                                {p.description}
                                            </p>
                                        )}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                            {p.platform && <span>🖥️ {p.platform}</span>}
                                            {p.completed_date && <span>📅 {new Date(p.completed_date).toLocaleDateString('en-IN')}</span>}
                                            {p.type && (
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600,
                                                    background: 'rgba(106,27,154,0.1)', color: '#6A1B9A',
                                                }}>{p.type}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                                        <StatusBadge status={statusKey} />
                                        {/* Project Link */}
                                        {p.project_link && (
                                            <a
                                                href={p.project_link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    padding: '6px 14px', borderRadius: 8, textDecoration: 'none',
                                                    background: 'linear-gradient(135deg, #6A1B9A, #9C27B0)',
                                                    color: 'white', fontSize: '0.75rem', fontWeight: 700,
                                                    boxShadow: '0 2px 8px rgba(106,27,154,0.3)',
                                                }}
                                            >
                                                🔗 Open Link
                                            </a>
                                        )}
                                        {p.is_verified && (
                                            <p style={{ fontSize: '0.7rem', color: '#15803D', fontWeight: 600 }}>
                                                ✓ Faculty Verified
                                            </p>
                                        )}
                                        {p.status === 'rejected' && p.rejection_reason && (
                                            <p style={{ fontSize: '0.7rem', color: '#DC2626', maxWidth: 160, textAlign: 'right' }}>
                                                {p.rejection_reason}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Submit Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Submit Project / Course" size="sm">
                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Details</p>
                        <div className="form-group">
                            <label className="form-label">Title <span className="required">*</span></label>
                            <input className="form-input" placeholder="e.g. Weather App using React" value={form.title} onChange={e => upd('title', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-input" placeholder="Brief description of the project or course" value={form.description} onChange={e => upd('description', e.target.value)} rows={3} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Project / Demo Link</label>
                            <input
                                className="form-input"
                                placeholder="https://github.com/... or https://live-demo.com"
                                type="url"
                                value={form.project_link}
                                onChange={e => upd('project_link', e.target.value)}
                            />
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                                GitHub repo, live demo, or certificate link
                            </p>
                        </div>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Type</label>
                                <select className="form-input" value={form.type} onChange={e => upd('type', e.target.value)}>
                                    <option value="project">🛠 Project</option>
                                    <option value="course">📚 Course</option>
                                    <option value="certification">🏅 Certification</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Platform</label>
                                <input className="form-input" placeholder="e.g. GitHub, Coursera" value={form.platform} onChange={e => upd('platform', e.target.value)} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Completion Date</label>
                            <input type="date" className="form-input" value={form.completed_date} onChange={e => upd('completed_date', e.target.value)} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-student">Submit</button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
