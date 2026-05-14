import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../utils/api';
import { HiOutlineClock, HiOutlinePlus, HiOutlineTrash, HiOutlinePencil, HiOutlineCheck, HiOutlineX } from 'react-icons/hi';

const INPUT_STYLE = {
    padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    fontSize: '0.82rem', width: '100%', boxSizing: 'border-box', outline: 'none',
};

const fmtTime = (t) => {
    if (!t) return '';
    // MySQL TIME comes as "HH:MM:SS"
    const [h, m] = t.split(':');
    const hh = parseInt(h);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = ((hh % 12) || 12);
    return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
};

const EMPTY_PERIOD = { period_number: '', label: '', start_time: '', end_time: '', window_open_before: 5, window_close_after: 10 };

export default function PeriodsConfig() {
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [adding, setAdding] = useState(false);
    const [newForm, setNewForm] = useState({ ...EMPTY_PERIOD });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/hod/periods');
            setPeriods(data.periods || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const startEdit = (p) => {
        setEditId(p.id);
        setEditForm({
            label: p.label || '',
            start_time: (p.start_time || '').slice(0, 5),
            end_time:   (p.end_time   || '').slice(0, 5),
            window_open_before:  p.window_open_before  ?? 5,
            window_close_after:  p.window_close_after  ?? 10,
        });
    };

    const saveEdit = async (id) => {
        setSaving(true); setError('');
        try {
            await api.patch(`/hod/periods/${id}`, editForm);
            setEditId(null);
            load();
        } catch (e) { setError(e?.response?.data?.error || 'Save failed'); }
        finally { setSaving(false); }
    };

    const deletePeriod = async (id) => {
        if (!window.confirm('Delete this period?')) return;
        try { await api.delete(`/hod/periods/${id}`); load(); }
        catch (e) { alert(e?.response?.data?.error || 'Delete failed'); }
    };

    const addPeriod = async () => {
        if (!newForm.period_number || !newForm.start_time || !newForm.end_time) {
            setError('Period number, start time, and end time are required.');
            return;
        }
        setSaving(true); setError('');
        try {
            await api.post('/hod/periods', newForm);
            setAdding(false);
            setNewForm({ ...EMPTY_PERIOD });
            load();
        } catch (e) {
            console.error(e);
            const errDeets = e.response ? `HTTP ${e.response.status}: ${JSON.stringify(e.response.data)}` : e.message;
            setError(e?.response?.data?.error || `Add failed - ${errDeets}`);
        }
        finally { setSaving(false); }
    };

    const periodRow = (p) => {
        const isEditing = editId === p.id;
        return (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {/* Period # */}
                <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--accent)', fontSize: '0.85rem' }}>P{p.period_number}</td>

                {/* Label */}
                <td style={{ padding: '10px 14px' }}>
                    {isEditing ? <input style={INPUT_STYLE} value={editForm.label} onChange={e => setEditForm(f => ({...f, label: e.target.value}))} /> : <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{p.label || `Period ${p.period_number}`}</span>}
                </td>

                {/* Start */}
                <td style={{ padding: '10px 14px' }}>
                    {isEditing ? <input type="time" style={INPUT_STYLE} value={editForm.start_time} onChange={e => setEditForm(f => ({...f, start_time: e.target.value}))} /> : <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{fmtTime(p.start_time)}</span>}
                </td>

                {/* End */}
                <td style={{ padding: '10px 14px' }}>
                    {isEditing ? <input type="time" style={INPUT_STYLE} value={editForm.end_time} onChange={e => setEditForm(f => ({...f, end_time: e.target.value}))} /> : <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{fmtTime(p.end_time)}</span>}
                </td>

                {/* Window */}
                <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {isEditing ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="number" min={0} max={30} style={{...INPUT_STYLE, width: 54}} value={editForm.window_open_before} onChange={e => setEditForm(f => ({...f, window_open_before: Number(e.target.value)}))} /> min before
                            <span>/</span>
                            <input type="number" min={0} max={30} style={{...INPUT_STYLE, width: 54}} value={editForm.window_close_after} onChange={e => setEditForm(f => ({...f, window_close_after: Number(e.target.value)}))} /> min after
                        </div>
                    ) : (
                        <span>Opens <b>{p.window_open_before}</b>m before · Closes <b>{p.window_close_after}</b>m after start</span>
                    )}
                </td>

                {/* Actions */}
                <td style={{ padding: '10px 14px' }}>
                    {isEditing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => saveEdit(p.id)} disabled={saving} title="Save"
                                style={{ padding: '5px 10px', borderRadius: 7, border: 'none', background: '#2E7D32', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem' }}>
                                <HiOutlineCheck size={13} /> Save
                            </button>
                            <button onClick={() => setEditId(null)} title="Cancel"
                                style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.78rem' }}>
                                <HiOutlineX size={13} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => startEdit(p)} title="Edit"
                                style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.78rem' }}>
                                <HiOutlinePencil size={13} />
                            </button>
                            <button onClick={() => deletePeriod(p.id)} title="Delete"
                                style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(183,28,28,0.3)', background: 'transparent', color: '#B71C1C', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.78rem' }}>
                                <HiOutlineTrash size={13} />
                            </button>
                        </div>
                    )}
                </td>
            </tr>
        );
    };

    return (
        <DashboardLayout>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <HiOutlineClock size={22} style={{ color: 'var(--accent)' }} />
                        Class Period Configuration
                    </h1>
                    <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Define daily class periods and their attendance marking windows.
                    </p>
                </div>
                <button
                    onClick={() => { setAdding(true); setError(''); setNewForm({ ...EMPTY_PERIOD }); }}
                    disabled={adding}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 8, border: 'none',
                        background: '#1565C0', color: '#fff', cursor: 'pointer',
                        fontSize: '0.82rem', fontWeight: 600,
                    }}>
                    <HiOutlinePlus size={15} /> Add Period
                </button>
            </div>

            {error && (
                <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 8, background: 'rgba(183,28,28,0.08)', border: '1px solid rgba(183,28,28,0.2)', color: '#B71C1C', fontSize: '0.82rem' }}>
                    {error}
                </div>
            )}

            {/* Info banner */}
            <div style={{ marginBottom: 18, padding: '12px 16px', borderRadius: 10, background: 'rgba(21,101,192,0.06)', border: '1px solid rgba(21,101,192,0.15)', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <HiOutlineClock size={15} style={{ marginTop: 2, flexShrink: 0, color: '#1565C0' }} />
                <span>
                    <b style={{ color: 'var(--text-primary)' }}>Attendance Window</b> — Faculty can only mark attendance within the configured window:&nbsp;
                    <i>N minutes before class start → M minutes after class start</i>.
                    Outside this window the system will block submission. Defaults: 5 min before, 10 min after.
                </span>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto', boxShadow: 'var(--shadow-sm)', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                            {['Period', 'Label', 'Start Time', 'End Time', 'Attendance Window', 'Actions'].map(h => (
                                <th key={h} style={{ padding: '10px 14px', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</td></tr>
                        ) : periods.length === 0 && !adding ? (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>No periods configured yet. Click "Add Period" to get started.</td></tr>
                        ) : (
                            periods.map(periodRow)
                        )}

                        {/* Add new period inline row */}
                        {adding && (
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(21,101,192,0.04)' }}>
                                <td style={{ padding: '10px 14px' }}>
                                    <input type="number" min={1} max={20} placeholder="#" style={{...INPUT_STYLE, width: 54}} value={newForm.period_number} onChange={e => setNewForm(f => ({...f, period_number: Number(e.target.value)}))} />
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                    <input style={INPUT_STYLE} placeholder="e.g. Class 1" value={newForm.label} onChange={e => setNewForm(f => ({...f, label: e.target.value}))} />
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                    <input type="time" style={INPUT_STYLE} value={newForm.start_time} onChange={e => setNewForm(f => ({...f, start_time: e.target.value}))} />
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                    <input type="time" style={INPUT_STYLE} value={newForm.end_time} onChange={e => setNewForm(f => ({...f, end_time: e.target.value}))} />
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                        <input type="number" min={0} max={30} style={{...INPUT_STYLE, width: 54}} value={newForm.window_open_before} onChange={e => setNewForm(f => ({...f, window_open_before: Number(e.target.value)}))} /> min before
                                        <span>/</span>
                                        <input type="number" min={0} max={30} style={{...INPUT_STYLE, width: 54}} value={newForm.window_close_after} onChange={e => setNewForm(f => ({...f, window_close_after: Number(e.target.value)}))} /> min after
                                    </div>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={addPeriod} disabled={saving}
                                            style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: '#2E7D32', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}>
                                            {saving ? '…' : 'Add'}
                                        </button>
                                        <button onClick={() => { setAdding(false); setError(''); }}
                                            style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem' }}>
                                            Cancel
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Example reference */}
            {periods.length === 0 && !loading && (
                <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <b>Example schedule:</b>
                    <ul style={{ margin: '6px 0 0 16px', lineHeight: 1.8 }}>
                        <li>Period 1 · 09:00 AM – 10:00 AM · Window: 08:55 AM → 09:10 AM</li>
                        <li>Period 2 · 10:00 AM – 11:00 AM · Window: 09:55 AM → 10:10 AM</li>
                        <li>Period 3 · 11:10 AM – 12:10 PM · Window: 11:05 AM → 11:20 AM</li>
                        <li>Period 4 · 01:00 PM – 02:00 PM · Window: 12:55 PM → 01:10 PM</li>
                    </ul>
                </div>
            )}
        </DashboardLayout>
    );
}
