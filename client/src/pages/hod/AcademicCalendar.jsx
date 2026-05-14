import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import {
    HiOutlineCalendar, HiOutlinePlus, HiOutlineRefresh,
    HiOutlineChevronLeft, HiOutlineChevronRight,
} from 'react-icons/hi';

const DAY_TYPES = {
    working:      { label: 'Working',      color: '#2E7D32', bg: 'rgba(46,125,50,0.1)' },
    holiday:      { label: 'Holiday',      color: '#B71C1C', bg: 'rgba(183,28,28,0.1)' },
    exam:         { label: 'Exam',         color: '#1565C0', bg: 'rgba(21,101,192,0.1)' },
    event:        { label: 'Event',        color: '#6A1B9A', bg: 'rgba(106,27,154,0.1)' },
    compensatory: { label: 'Compensatory', color: '#E65100', bg: 'rgba(245,127,23,0.1)' },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Local-timezone-safe helper ────────────────────────────────────────────────
// Returns "YYYY-MM-DD" for a Date object using LOCAL fields (not UTC),
// preventing the off-by-one bug when the machine is east of UTC (e.g. IST).
function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

export default function HodAcademicCalendar() {
    const today = new Date();
    const todayStr = localDateStr(today);   // correct local today string

    const [year, setYear]     = useState(today.getFullYear());
    const [month, setMonth]   = useState(today.getMonth() + 1); // 1-indexed
    const [entries, setEntries] = useState({});        // { 'YYYY-MM-DD': entry }
    const [loading, setLoading] = useState(true);
    const [modal, setModal]   = useState(null);        // { date, entry }
    const [form, setForm]     = useState({ day_type: 'working', label: '' });
    const [saving, setSaving] = useState(false);
    const [initializing, setInitializing] = useState(false);

    const fetchMonth = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get(`/hod/academic-calendar?month=${month}&year=${year}`);
            const map = {};
            (r.data.calendar || []).forEach(e => {
                // Use only the date part (remove time component if any)
                const dateKey = (e.calendar_date || '').split('T')[0];
                map[dateKey] = e;
            });
            setEntries(map);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [month, year]);

    useEffect(() => { fetchMonth(); }, [fetchMonth]);

    // Build calendar grid
    const firstDay   = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

    // ── Initialize Month ──────────────────────────────────────────────────────
    const initializeMonth = async () => {
        const confirmed = window.confirm(
            `Initialize all dates in ${MONTHS[month-1]} ${year}?\n` +
            'Weekdays → Working, Weekends → Holiday.\n' +
            'This will NOT overwrite dates you have already customized (uses ON DUPLICATE KEY).'
        );
        if (!confirmed) return;
        setInitializing(true);
        try {
            // Build YYYY-MM-01 and last day of month
            const mm = String(month).padStart(2, '0');
            const lastDay = new Date(year, month, 0).getDate();
            const start_date = `${year}-${mm}-01`;
            const end_date   = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
            await api.post('/hod/academic-calendar', {
                academic_year_id: 1,   // default; could be fetched dynamically
                start_date,
                end_date,
                weekends: ['Saturday', 'Sunday'],
            });
            await fetchMonth();
        } catch (err) {
            alert(err?.response?.data?.error || 'Initialization failed');
        } finally {
            setInitializing(false);
        }
    };

    const openEdit = (dateStr, entry) => {
        setForm({ day_type: entry?.day_type || 'working', label: entry?.label || '' });
        setModal({ date: dateStr, entry });
    };

    const save = async () => {
        setSaving(true);
        try {
            if (modal.entry) {
                // Update existing entry by ID
                await api.patch(`/hod/academic-calendar/${modal.entry.id}`, form);
            } else {
                // Create new entry
                await api.post('/hod/academic-calendar', {
                    academic_year_id: 1,
                    calendar_date: modal.date,
                    ...form,
                });
            }
            setModal(null);
            fetchMonth();
        } catch (err) {
            alert(err?.response?.data?.error || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    // Legend row stats
    const stats = Object.values(entries).reduce((acc, e) => {
        acc[e.day_type] = (acc[e.day_type] || 0) + 1;
        return acc;
    }, {});

    return (
        <DashboardLayout>
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                        Academic Calendar
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
                        Manage working days, holidays, and exam dates for your department
                    </p>
                </div>
                {/* Initialize Month button */}
                <button
                    onClick={initializeMonth}
                    disabled={initializing}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 8, border: 'none',
                        background: initializing ? 'var(--bg-secondary)' : '#1565C0',
                        color: initializing ? 'var(--text-secondary)' : '#fff',
                        cursor: initializing ? 'not-allowed' : 'pointer',
                        fontSize: '0.82rem', fontWeight: 600,
                    }}>
                    <HiOutlineRefresh size={15} />
                    {initializing ? 'Initializing…' : 'Initialize Month'}
                </button>
            </div>

            {/* Month Navigator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <button onClick={prevMonth} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    <HiOutlineChevronLeft size={18} />
                </button>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, minWidth: 160, textAlign: 'center' }}>
                    {MONTHS[month - 1]} {year}
                </h2>
                <button onClick={nextMonth} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    <HiOutlineChevronRight size={18} />
                </button>

                {/* Legend */}
                <div style={{ display: 'flex', gap: 10, marginLeft: 16, flexWrap: 'wrap' }}>
                    {Object.entries(DAY_TYPES).map(([k, v]) => (
                        <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: v.color, fontWeight: 600 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: v.color, display: 'inline-block' }} />
                            {v.label} {stats[k] ? `(${stats[k]})` : ''}
                        </span>
                    ))}
                </div>
            </div>

            {/* Calendar Grid */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    {DAYS.map(d => (
                        <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
                    ))}
                </div>

                {loading ? (
                    <div style={{ padding: 60, display: 'flex', justifyContent: 'center' }}><LoadingSpinner /></div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                        {cells.map((day, idx) => {
                            if (!day) return <div key={`empty-${idx}`} style={{ minHeight: 80, borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }} />;

                            // ── Use local date string (NO toISOString — avoids UTC drift) ──
                            const mm  = String(month).padStart(2, '0');
                            const dd  = String(day).padStart(2, '0');
                            const dateStr = `${year}-${mm}-${dd}`;

                            const entry   = entries[dateStr];
                            const cfg     = entry ? (DAY_TYPES[entry.day_type] || DAY_TYPES.working) : null;
                            const isToday = dateStr === todayStr;   // compare local strings

                            return (
                                <div
                                    key={dateStr}
                                    onClick={() => openEdit(dateStr, entry)}
                                    style={{
                                        minHeight: 80, padding: 8, cursor: 'pointer',
                                        borderBottom: '1px solid var(--border)',
                                        borderRight: '1px solid var(--border)',
                                        background: entry ? cfg.bg : 'transparent',
                                        position: 'relative',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => { if (!entry) e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                    onMouseLeave={e => { if (!entry) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div style={{
                                        width: 26, height: 26, borderRadius: '50%',
                                        background: isToday ? '#1565C0' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.82rem', fontWeight: isToday ? 700 : 500,
                                        color: isToday ? '#fff' : (entry ? cfg.color : 'var(--text-primary)'),
                                        marginBottom: 4,
                                    }}>{day}</div>

                                    {entry && (
                                        <div style={{ fontSize: '0.65rem', color: cfg.color, fontWeight: 700, lineHeight: 1.3 }}>
                                            {DAY_TYPES[entry.day_type]?.label}
                                            {entry.label && <div style={{ opacity: 0.85, fontWeight: 500 }}>{entry.label}</div>}
                                        </div>
                                    )}

                                    {!entry && (
                                        <div style={{ position: 'absolute', bottom: 6, right: 6, opacity: 0, transition: 'opacity 0.15s' }}
                                            className="add-icon">
                                            <HiOutlinePlus size={12} style={{ color: 'var(--text-tertiary)' }} />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            {modal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, minWidth: 340, boxShadow: 'var(--shadow-xl)' }}>
                        <h3 style={{ margin: '0 0 4px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {modal.date}
                        </h3>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 20 }}>
                            {modal.entry ? 'Update day type' : 'Set day type for this date'}
                        </p>

                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Day Type</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                            {Object.entries(DAY_TYPES).map(([k, v]) => (
                                <button key={k} onClick={() => setForm(f => ({ ...f, day_type: k }))}
                                    style={{
                                        padding: '8px 12px', borderRadius: 8, border: `2px solid ${form.day_type === k ? v.color : 'var(--border)'}`,
                                        background: form.day_type === k ? v.bg : 'transparent',
                                        color: form.day_type === k ? v.color : 'var(--text-secondary)',
                                        cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, textAlign: 'left',
                                    }}>
                                    {v.label}
                                </button>
                            ))}
                        </div>

                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Label (optional)</label>
                        <input
                            value={form.label}
                            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                            placeholder='e.g. Diwali, Mid-Sem Exam…'
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none', marginBottom: 20 }}
                        />

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => setModal(null)} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                            <button onClick={save} disabled={saving}
                                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#2E7D32', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, opacity: saving ? 0.6 : 1 }}>
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
