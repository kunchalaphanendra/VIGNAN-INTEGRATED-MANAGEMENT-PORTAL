import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

const eventColors = {
    exam: '#DC2626',
    assignment_deadline: '#F59E0B',
    holiday: '#16A34A',
    event: '#6A1B9A',
    other: '#6B7280',
};

const eventLabels = {
    exam: 'Exam',
    assignment_deadline: 'Assignment Deadline',
    holiday: 'Holiday',
    event: 'Event',
    other: 'Other',
};

export default function Calendar({ role }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', event_type: 'event', event_date: '', end_date: '' });
    const canCreate = ['principal', 'hod'].includes(role);

    useEffect(() => { load(); }, []);
    const load = async () => {
        try { const r = await api.get(`/${role}/calendar`); setEvents(r.data.events); } catch { } finally { setLoading(false); }
    };
    const handleCreate = async (e) => {
        e.preventDefault();
        try { await api.post(`/${role}/calendar`, form); setShowModal(false); load(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
    };
    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    // Group by month
    const grouped = {};
    events.forEach(ev => {
        const month = new Date(ev.event_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        if (!grouped[month]) grouped[month] = [];
        grouped[month].push(ev);
    });

    return (
        <DashboardLayout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Academic Calendar</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Upcoming events, exams and holidays</p>
                </div>
                {canCreate && (
                    <button onClick={() => setShowModal(true)} className="btn btn-primary">+ New Event</button>
                )}
            </div>

            {Object.keys(grouped).length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <p>No events scheduled yet</p>
                </div>
            ) : Object.entries(grouped).map(([month, evs]) => (
                <div key={month} style={{ marginBottom: 28 }}>
                    <h3 style={{
                        fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: 'var(--text-tertiary)',
                        marginBottom: 12,
                    }}>{month}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {evs.map(ev => (
                            <div key={ev.id} style={{
                                display: 'flex', alignItems: 'center', gap: 16,
                                padding: '16px 20px', borderRadius: 14,
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                boxShadow: 'var(--shadow-sm)',
                            }}>
                                <div style={{
                                    width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                    background: eventColors[ev.event_type] || '#6B7280', color: 'white',
                                }}>
                                    <span style={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1 }}>
                                        {new Date(ev.event_date).getDate()}
                                    </span>
                                    <span style={{ fontSize: '0.6rem', fontWeight: 600, opacity: 0.85, marginTop: 1 }}>
                                        {new Date(ev.event_date).toLocaleDateString('en-US', { month: 'short' })}
                                    </span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{ev.title}</p>
                                    {ev.description && (
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{ev.description}</p>
                                    )}
                                    <span style={{
                                        display: 'inline-block', marginTop: 6,
                                        padding: '2px 9px', borderRadius: 100,
                                        fontSize: '0.68rem', fontWeight: 600,
                                        background: `${eventColors[ev.event_type] || '#6B7280'}18`,
                                        color: eventColors[ev.event_type] || '#6B7280',
                                    }}>{eventLabels[ev.event_type] || ev.event_type}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Calendar Event" size="sm">
                <form onSubmit={handleCreate} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Event Details</p>
                        <div className="form-group">
                            <label className="form-label">Event Title <span className="required">*</span></label>
                            <input className="form-input" placeholder="e.g. Mid Semester Exam – CS" value={form.title} onChange={e => upd('title', e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-input" placeholder="Optional details about this event" value={form.description} onChange={e => upd('description', e.target.value)} rows={3} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Event Type</label>
                            <select className="form-input" value={form.event_type} onChange={e => upd('event_type', e.target.value)}>
                                <option value="exam">📝 Exam</option>
                                <option value="assignment_deadline">📌 Assignment Deadline</option>
                                <option value="holiday">🏖 Holiday</option>
                                <option value="event">🎉 Event</option>
                                <option value="other">📋 Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="modal-section">
                        <p className="modal-section-title">Schedule</p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Start Date <span className="required">*</span></label>
                                <input type="date" className="form-input" value={form.event_date} onChange={e => upd('event_date', e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">End Date <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                                <input type="date" className="form-input" value={form.end_date} onChange={e => upd('end_date', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary">Create Event</button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
