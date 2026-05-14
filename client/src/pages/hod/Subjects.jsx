import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

export default function HodSubjects() {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', code: '', semester: 1, credits: 3 });

    useEffect(() => { load(); }, []);
    const load = async () => {
        try {
            const r = await api.get('/hod/subjects');
            setSubjects(r.data.subjects || []);
        } catch { } finally { setLoading(false); }
    };
    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/hod/subjects', form);
            setShowModal(false);
            setForm({ name: '', code: '', semester: 1, credits: 3 });
            load();
        } catch (err) { alert(err.response?.data?.error || 'Error'); }
    };
    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const columns = [
        { key: 'code', header: 'Code', accessor: 'code' },
        { key: 'name', header: 'Subject Name', accessor: 'name' },
        { key: 'semester', header: 'Semester', accessor: 'semester' },
        { key: 'credits', header: 'Credits', accessor: 'credits' },
    ];

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Subjects</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Subjects offered in your department</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-hod">+ Add Subject</button>
            </div>

            <DataTable columns={columns} data={subjects} />

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Subject" size="sm">
                <form onSubmit={handleCreate} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Subject Details</p>
                        <div className="form-group">
                            <label className="form-label">Subject Name <span className="required">*</span></label>
                            <input className="form-input" placeholder="e.g. Data Structures" value={form.name} onChange={e => upd('name', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Subject Code <span className="required">*</span></label>
                            <input className="form-input" placeholder="e.g. CS401" value={form.code} onChange={e => upd('code', e.target.value)} required />
                        </div>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Semester</label>
                                <select className="form-input" value={form.semester} onChange={e => upd('semester', parseInt(e.target.value))}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Credits</label>
                                <input type="number" className="form-input" placeholder="3" value={form.credits} onChange={e => upd('credits', parseInt(e.target.value))} min={1} max={6} />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-hod">Add Subject</button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
