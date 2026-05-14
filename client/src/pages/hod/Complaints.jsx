import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

export default function HodComplaints() {
    const [complaints, setComplaints] = useState([]);
    const [windows, setWindows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showWindowModal, setShowWindowModal] = useState(false);
    const [showDetail, setShowDetail] = useState(null);
    const [windowForm, setWindowForm] = useState({ open_date: '', close_date: '' });
    const [statusUpdate, setStatusUpdate] = useState({ status: '', admin_notes: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const [c, w] = await Promise.all([
                api.get('/hod/complaints'),
                api.get('/hod/complaint-windows'),
            ]);
            setComplaints(c.data.complaints || []);
            setWindows(w.data.windows || []);
        } catch { }
        finally { setLoading(false); }
    };

    // Check if any HOD window is currently active
    const today = new Date();
    const activeWindow = windows.find(w => {
        const open = new Date(w.open_date);
        const close = new Date(w.close_date);
        close.setHours(23, 59, 59);
        return today >= open && today <= close;
    });

    const createWindow = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hod/complaint-window', windowForm);
            setShowWindowModal(false);
            load();
        } catch (err) {
            alert(err.response?.data?.error || 'Error creating window');
        }
    };

    const updateStatus = async (id) => {
        setSaving(true);
        try {
            await api.patch(`/hod/complaints/${id}/status`, statusUpdate);
            setShowDetail(null);
            load();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to update status');
        } finally {
            setSaving(false);
        }
    };

    const statusStyles = {
        submitted:   { bg: 'rgba(245,158,11,0.12)', color: '#D97706', label: 'Submitted'   },
        in_progress: { bg: 'rgba(59,130,246,0.12)',  color: '#2563EB', label: 'In Progress' },
        resolved:    { bg: 'rgba(22,163,74,0.12)',   color: '#15803D', label: 'Resolved'    },
        rejected:    { bg: 'rgba(220,38,38,0.1)',    color: '#DC2626', label: 'Rejected'    },
        under_review:{ bg: 'rgba(59,130,246,0.12)',  color: '#2563EB', label: 'In Progress' },
        dismissed:   { bg: 'rgba(107,114,128,0.1)',  color: '#6B7280', label: 'Rejected'    },
    };

    const columns = [
        { key: 'ref', header: 'Ref', accessor: 'complaint_ref' },
        {
            key: 'student', header: 'Student', render: r =>
                r.is_anonymous
                    ? `Anonymous (Year: ${r.year || '—'})`
                    : r.student_name || '—'
        },
        {
            key: 'message', header: 'Message', render: r => (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {r.message?.substring(0, 60)}...
                </span>
            )
        },
        {
            key: 'status', header: 'Status', render: r => {
                const s = statusStyles[r.status] || statusStyles.submitted;
                return (
                    <span style={{
                        padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem',
                        fontWeight: 600, background: s.bg, color: s.color,
                    }}>{s.label || r.status?.replace(/_/g, ' ')}</span>
                );
            }
        },
        { key: 'date', header: 'Date', accessor: r => new Date(r.submitted_at).toLocaleDateString() },
        {
            key: 'actions', header: '', sortable: false, render: r => (
                <button
                    onClick={() => { setShowDetail(r); setStatusUpdate({ status: r.status, admin_notes: r.admin_notes || '' }); }}
                    className="btn btn-sm btn-outline"
                >View</button>
            )
        }
    ];

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                        📣 Complaint Portal
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Manage department complaints — set collection windows and review submissions
                    </p>
                </div>
                <button onClick={() => setShowWindowModal(true)} className="btn btn-hod">
                    Set Window
                </button>
            </div>

            {/* Portal Status Banner */}
            <div style={{
                borderRadius: 12, padding: '14px 20px', marginBottom: 24,
                background: activeWindow ? 'rgba(46,125,50,0.06)' : 'rgba(220,38,38,0.06)',
                border: `1px solid ${activeWindow ? 'rgba(46,125,50,0.2)' : 'rgba(220,38,38,0.2)'}`,
                display: 'flex', alignItems: 'center', gap: 12,
            }}>
                <span style={{ fontSize: '1.5rem' }}>{activeWindow ? '✅' : '🔒'}</span>
                <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 700, color: activeWindow ? '#2E7D32' : '#DC2626' }}>
                        HOD Complaint Portal is {activeWindow ? 'OPEN' : 'CLOSED'}
                    </p>
                    {activeWindow && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            Students in your department can submit complaints until{' '}
                            {new Date(activeWindow.close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    )}
                    {!activeWindow && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            Click "Set Window" to open the complaint portal for your department
                        </p>
                    )}
                </div>
            </div>

            {/* Active windows list */}
            {windows.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                    {windows.slice(0, 3).map(w => {
                        const wOpen = new Date(w.open_date);
                        const wClose = new Date(w.close_date);
                        wClose.setHours(23, 59, 59);
                        const isActive = today >= wOpen && today <= wClose;
                        return (
                            <div key={w.id} style={{
                                padding: '6px 14px', borderRadius: 8,
                                fontSize: '0.78rem', fontWeight: 500,
                                background: isActive ? 'rgba(46,125,50,0.08)' : 'var(--bg-secondary)',
                                border: `1px solid ${isActive ? 'rgba(46,125,50,0.3)' : 'var(--border)'}`,
                                color: isActive ? '#2E7D32' : 'var(--text-secondary)',
                            }}>
                                {isActive ? '🟢 ' : '📅 '}
                                {new Date(w.open_date).toLocaleDateString()} — {new Date(w.close_date).toLocaleDateString()}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Complaints table */}
            {complaints.length === 0 ? (
                <div style={{
                    borderRadius: 14, padding: '48px 24px', textAlign: 'center',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        No complaints in your department yet
                    </p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginTop: 6 }}>
                        Open a complaint window so students can submit their complaints
                    </p>
                </div>
            ) : (
                <DataTable columns={columns} data={complaints} />
            )}

            {/* Set Window Modal */}
            <Modal isOpen={showWindowModal} onClose={() => setShowWindowModal(false)} title="Set Complaint Window" size="sm">
                <form onSubmit={createWindow} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Window Period</p>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                            Students in your department will be able to submit complaints during this period.
                        </p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Open Date <span className="required">*</span></label>
                                <input type="date" className="form-input" value={windowForm.open_date}
                                    onChange={e => setWindowForm({ ...windowForm, open_date: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Close Date <span className="required">*</span></label>
                                <input type="date" className="form-input" value={windowForm.close_date}
                                    onChange={e => setWindowForm({ ...windowForm, close_date: e.target.value })} required />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowWindowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-hod">Create Window</button>
                    </div>
                </form>
            </Modal>

            {/* Detail Modal */}
            <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={`Complaint ${showDetail?.complaint_ref || ''}`} size="md">
                {showDetail && (
                    <div className="modal-form">
                        {/* Student info */}
                        <div style={{
                            padding: '10px 14px', borderRadius: 8, marginBottom: 12,
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
                            fontSize: '0.8rem', color: 'var(--text-secondary)',
                            display: 'flex', gap: 16, flexWrap: 'wrap',
                        }}>
                            {showDetail.is_anonymous
                                ? <span>🔐 Anonymous (Year {showDetail.year || '—'})</span>
                                : <><span>👤 {showDetail.student_name || '—'}</span><span>📋 {showDetail.roll_number || '—'}</span></>
                            }
                            <span>📅 {new Date(showDetail.submitted_at).toLocaleDateString('en-IN')}</span>
                        </div>

                        <div style={{
                            padding: 16, borderRadius: 12,
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-light)',
                        }}>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                                {showDetail.message}
                            </p>
                        </div>

                        {showDetail.attachment_url && (
                            <a href={showDetail.attachment_url} target="_blank" rel="noreferrer"
                                style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--hod)' }}>
                                📎 View Attachment
                            </a>
                        )}

                        <div className="modal-section">
                            <p className="modal-section-title">Update Status</p>
                            <div className="form-group">
                                <label className="form-label">Status</label>
                                <select className="form-input" value={statusUpdate.status}
                                    onChange={e => setStatusUpdate({ ...statusUpdate, status: e.target.value })}>
                                    <option value="submitted">📋 Submitted</option>
                                    <option value="in_progress">🔄 In Progress</option>
                                    <option value="resolved">✅ Resolved</option>
                                    <option value="rejected">❌ Rejected</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Remarks / Notes</label>
                                <textarea className="form-input" rows={3} placeholder="Add feedback for this complaint..."
                                    value={statusUpdate.admin_notes}
                                    onChange={e => setStatusUpdate({ ...statusUpdate, admin_notes: e.target.value })} />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline" onClick={() => setShowDetail(null)}>Close</button>
                            <button onClick={() => updateStatus(showDetail.id)} disabled={saving} className="btn btn-hod">
                                {saving ? 'Saving...' : 'Update Status'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </DashboardLayout>
    );
}
