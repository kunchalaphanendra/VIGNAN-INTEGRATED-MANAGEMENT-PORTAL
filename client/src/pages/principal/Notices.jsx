import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

export default function Notices({ role }) {
    const [notices, setNotices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ title: '', body: '', target_role: 'all', priority: 'general', category: 'academic' });
    const canPost = ['principal', 'hod', 'faculty'].includes(role);

    useEffect(() => { load(); }, []);
    const load = async () => {
        try { const r = await api.get(`/${role}/notices`); setNotices(r.data.notices); } catch { } finally { setLoading(false); }
    };
    const handlePost = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/${role}/notices`, form);
            setShowModal(false);
            setForm({ title: '', body: '', target_role: 'all', priority: 'general', category: 'academic' });
            load();
        } catch (err) { alert(err.response?.data?.error || 'Error'); }
    };
    const markRead = async (id) => {
        if (role === 'student') { try { await api.patch(`/student/notices/${id}/read`); load(); } catch { } }
    };
    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const priorityStyles = {
        general: { bg: 'rgba(107,114,128,0.1)', color: '#6B7280' },
        important: { bg: 'rgba(21,101,192,0.1)', color: '#1565C0' },
        urgent: { bg: 'rgba(220,38,38,0.1)', color: '#DC2626' },
    };

    const columns = [
        { key: 'title', header: 'Title', accessor: 'title' },
        {
            key: 'priority', header: 'Priority', render: r => {
                const s = priorityStyles[r.priority] || priorityStyles.general;
                return (
                    <span style={{
                        padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem',
                        fontWeight: 600, background: s.bg, color: s.color,
                    }}>{r.priority}</span>
                );
            }
        },
        { key: 'date', header: 'Date', accessor: r => new Date(r.created_at).toLocaleDateString() },
        {
            key: 'body', header: 'Content', render: r => (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.body?.substring(0, 80)}...</span>
            )
        },
    ];

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Notices</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Announcements and circulars</p>
                </div>
                {canPost && <button onClick={() => setShowModal(true)} className="btn btn-primary">+ Post Notice</button>}
            </div>

            <DataTable columns={columns} data={notices} />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Post New Notice">
                <form onSubmit={handlePost} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Notice Content</p>
                        <div className="form-group">
                            <label className="form-label">Title <span className="required">*</span></label>
                            <input className="form-input" placeholder="e.g. Mid-term exam schedule" value={form.title} onChange={e => upd('title', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Body <span className="required">*</span></label>
                            <textarea className="form-input" placeholder="Write the full notice content here..." value={form.body} onChange={e => upd('body', e.target.value)} rows={4} required />
                        </div>
                    </div>

                    <div className="modal-section">
                        <p className="modal-section-title">Audience & Priority</p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Target Audience</label>
                                <select className="form-input" value={form.target_role} onChange={e => upd('target_role', e.target.value)}>
                                    <option value="all">All Users</option>
                                    <option value="faculty">Faculty Only</option>
                                    <option value="student">Students Only</option>
                                    <option value="hod">HODs Only</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Priority Level</label>
                                <select className="form-input" value={form.priority} onChange={e => upd('priority', e.target.value)}>
                                    <option value="general">🔵 General</option>
                                    <option value="important">🟡 Important</option>
                                    <option value="urgent">🔴 Urgent</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Post Notice</button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
