import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

export default function HodAssignments() {
    const [assignments, setAssignments] = useState([]);
    const [faculty, setFaculty] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ faculty_id: '', subject_id: '', year: 1, section: 'A', is_class_teacher: false });

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const [aRes, fRes, sRes] = await Promise.all([
                api.get('/hod/assignments'),
                api.get('/hod/faculty'),
                api.get('/hod/subjects'),
            ]);
            setAssignments(aRes.data.assignments);
            setFaculty(fRes.data.faculty);
            setSubjects(sRes.data.subjects);
        } catch { } finally { setLoading(false); }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.faculty_id || !form.subject_id) return alert('Please select both faculty and subject');
        try {
            await api.post('/hod/assignments', { ...form, academic_year_id: 1 });
            setShowModal(false);
            setForm({ faculty_id: '', subject_id: '', year: 1, section: 'A', is_class_teacher: false });
            load();
        } catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Remove this assignment? This will also delete related attendance and timetable records.')) return;
        try {
            await api.delete(`/hod/assignments/${id}`);
            load();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to remove assignment');
        }
    };

    const columns = [
        {
            key: 'faculty', header: 'Faculty', render: r => (
                <span>
                    <span style={{ fontWeight: 600 }}>{r.faculty_name}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginLeft: 6 }}>({r.faculty_login})</span>
                </span>
            )
        },
        {
            key: 'subject', header: 'Subject', render: r => (
                <span>
                    <span style={{ fontWeight: 500 }}>{r.subject_name}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', marginLeft: 6 }}>({r.subject_code})</span>
                </span>
            )
        },
        { key: 'year', header: 'Year', accessor: 'year' },
        { key: 'section', header: 'Section', accessor: 'section' },
        {
            key: 'ct', header: 'Class Teacher', render: r =>
                r.is_class_teacher ? (
                    <span style={{
                        padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem',
                        fontWeight: 600, background: 'rgba(22,163,74,0.12)', color: '#15803D',
                    }}>Yes</span>
                ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>No</span>
                )
        },
        {
            key: 'actions', header: '', sortable: false, render: r => (
                <button onClick={() => handleDelete(r.id)} className="btn btn-sm btn-danger">Remove</button>
            )
        }
    ];

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Class Assignments</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Assign faculty to subjects for each year & section</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-hod">+ Assign Faculty</button>
            </div>

            <DataTable columns={columns} data={assignments} />

            {assignments.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>No class assignments yet</p>
                    <p>Click "+ Assign Faculty" to assign a faculty member to a subject and section.</p>
                </div>
            )}

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Assign Faculty to Class">
                <form onSubmit={handleCreate} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Assignment Details</p>
                        <div className="form-group">
                            <label className="form-label">Faculty Member <span className="required">*</span></label>
                            <select className="form-input" value={form.faculty_id} onChange={e => setForm({ ...form, faculty_id: parseInt(e.target.value) })} required>
                                <option value="">— Select Faculty —</option>
                                {faculty.filter(f => f.is_active).map(f => (
                                    <option key={f.id} value={f.id}>{f.full_name} ({f.login_id})</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Subject <span className="required">*</span></label>
                            <select className="form-input" value={form.subject_id} onChange={e => setForm({ ...form, subject_id: parseInt(e.target.value) })} required>
                                <option value="">— Select Subject —</option>
                                {subjects.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.code}) — Sem {s.semester}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="modal-section">
                        <p className="modal-section-title">Class Details</p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Year</label>
                                <select className="form-input" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) })}>
                                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Section</label>
                                <select className="form-input" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })}>
                                    {['A', 'B', 'C', 'D'].map(s => <option key={s} value={s}>Section {s}</option>)}
                                </select>
                            </div>
                        </div>
                        <label style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)',
                        }}>
                            <input type="checkbox" checked={form.is_class_teacher}
                                onChange={e => setForm({ ...form, is_class_teacher: e.target.checked })}
                                style={{ width: 16, height: 16, borderRadius: 4 }} />
                            Designate as Class Teacher for this section
                        </label>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-hod">Create Assignment</button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
