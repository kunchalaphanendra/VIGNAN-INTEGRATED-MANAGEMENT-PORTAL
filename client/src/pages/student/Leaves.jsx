import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

export default function StudentLeaves() {
    const [leaves, setLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ leave_type: 'medical', from_date: '', to_date: '', reason: '' });

    useEffect(() => { load(); }, []);
    const load = async () => { try { const r = await api.get('/student/leaves'); setLeaves(r.data.leaves); } catch { } finally { setLoading(false); } };
    const handleSubmit = async (e) => {
        e.preventDefault();
        try { await api.post('/student/leaves', form); setShowModal(false); load(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
    };
    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const statusStyles = {
        pending: { bg: 'rgba(245,158,11,0.12)', color: '#D97706' },
        approved: { bg: 'rgba(22,163,74,0.12)', color: '#15803D' },
        rejected: { bg: 'rgba(220,38,38,0.1)', color: '#DC2626' },
    };

    const cols = [
        { key: 'type', header: 'Type', accessor: 'leave_type' },
        { key: 'from', header: 'From', accessor: r => new Date(r.from_date).toLocaleDateString() },
        { key: 'to', header: 'To', accessor: r => new Date(r.to_date).toLocaleDateString() },
        { key: 'reason', header: 'Reason', render: r => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.reason?.substring(0, 50)}</span> },
        {
            key: 'status', header: 'Status', render: r => {
                const s = statusStyles[r.status] || statusStyles.pending;
                return <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600, background: s.bg, color: s.color }}>{r.status}</span>;
            }
        },
        { key: 'teacher', header: 'Teacher', accessor: 'faculty_name' },
        { key: 'remarks', header: 'Remarks', render: r => <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.remarks || '—'}</span> }
    ];

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;
    return (
        <DashboardLayout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>My Leave Requests</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Apply for leave and track status</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-student">+ Request Leave</button>
            </div>

            <DataTable columns={cols} data={leaves} />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Request Leave" size="sm">
                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Leave Details</p>
                        <div className="form-group">
                            <label className="form-label">Leave Type</label>
                            <select className="form-input" value={form.leave_type} onChange={e => upd('leave_type', e.target.value)}>
                                <option value="medical">🏥 Medical</option>
                                <option value="personal">🏠 Personal</option>
                                <option value="event">🎉 Event</option>
                            </select>
                        </div>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">From Date <span className="required">*</span></label>
                                <input type="date" className="form-input" value={form.from_date} onChange={e => upd('from_date', e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">To Date <span className="required">*</span></label>
                                <input type="date" className="form-input" value={form.to_date} onChange={e => upd('to_date', e.target.value)} required />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Reason <span className="required">*</span></label>
                            <textarea className="form-input" placeholder="Explain why you need leave..." value={form.reason} onChange={e => upd('reason', e.target.value)} rows={3} required />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-student">Submit Request</button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
