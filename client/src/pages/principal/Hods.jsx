import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

export default function PrincipalHods() {
    const [hods, setHods] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ full_name: '', email: '', phone: '', department_id: '', password: '' });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [h, d] = await Promise.all([api.get('/principal/hods'), api.get('/principal/departments')]);
            setHods(h.data.hods);
            setDepartments(d.data.departments);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/principal/hod', form);
            setShowModal(false);
            setForm({ full_name: '', email: '', phone: '', department_id: '', password: '' });
            fetchData();
        } catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    const handleDeactivate = async (id) => {
        if (!confirm('Are you sure you want to deactivate this HOD?')) return;
        try { await api.delete(`/principal/hod/${id}`); fetchData(); } catch { }
    };

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const columns = [
        { key: 'login_id', header: 'Login ID', accessor: 'login_id' },
        { key: 'name', header: 'Name', accessor: 'full_name' },
        { key: 'dept', header: 'Department', accessor: 'department_name' },
        { key: 'email', header: 'Email', accessor: 'email' },
        { key: 'phone', header: 'Phone', accessor: 'phone' },
        {
            key: 'status', header: 'Status', render: row => (
                <span style={{
                    padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600,
                    background: row.is_active ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)',
                    color: row.is_active ? '#15803D' : '#DC2626',
                }}>{row.is_active ? 'Active' : 'Inactive'}</span>
            )
        },
        {
            key: 'actions', header: 'Actions', sortable: false, render: row => (
                <button onClick={() => handleDeactivate(row.id)} className="btn btn-sm btn-danger" disabled={!row.is_active}>Deactivate</button>
            )
        }
    ];

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>HOD Management</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Create and manage Head of Departments</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-principal">+ Create HOD</button>
            </div>

            <DataTable columns={columns} data={hods} />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create New HOD">
                <form onSubmit={handleCreate} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Personal Information</p>
                        <div className="form-group">
                            <label className="form-label">Full Name <span className="required">*</span></label>
                            <input className="form-input" placeholder="e.g. Dr. Srinu Kumar" value={form.full_name} onChange={e => upd('full_name', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Department <span className="required">*</span></label>
                            <select className="form-input" value={form.department_id} onChange={e => upd('department_id', e.target.value)} required>
                                <option value="">— Select Department —</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="modal-section">
                        <p className="modal-section-title">Contact Details</p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input type="email" className="form-input" placeholder="hod@example.com" value={form.email} onChange={e => upd('email', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone Number</label>
                                <input className="form-input" placeholder="10-digit number" value={form.phone} onChange={e => upd('phone', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="modal-section">
                        <p className="modal-section-title">Account Security</p>
                        <div className="form-group">
                            <label className="form-label">Login Password <span className="required">*</span></label>
                            <input type="password" className="form-input" placeholder="Minimum 8 characters" value={form.password} onChange={e => upd('password', e.target.value)} required minLength={8} />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-principal">Create HOD</button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
