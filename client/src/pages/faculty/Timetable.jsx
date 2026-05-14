import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_COLORS = {
    Monday:    { main: '#1565C0', grad: 'linear-gradient(135deg,#1565C0,#1976D2)' },
    Tuesday:   { main: '#2E7D32', grad: 'linear-gradient(135deg,#2E7D32,#388E3C)' },
    Wednesday: { main: '#6A1B9A', grad: 'linear-gradient(135deg,#6A1B9A,#7B1FA2)' },
    Thursday:  { main: '#E65100', grad: 'linear-gradient(135deg,#E65100,#F57C00)' },
    Friday:    { main: '#B71C1C', grad: 'linear-gradient(135deg,#B71C1C,#C62828)' },
    Saturday:  { main: '#00695C', grad: 'linear-gradient(135deg,#00695C,#00796B)' },
};

const TYPE_BADGES = {
    class: { label: 'CLASS', bg: 'rgba(21,101,192,0.12)', color: '#1565C0' },
    lab:   { label: 'LAB',   bg: 'rgba(46,125,50,0.12)',  color: '#2E7D32'  },
    free:  { label: 'FREE',  bg: 'rgba(100,100,100,0.1)', color: '#616161'  },
};

function TypeBadge({ type }) {
    const cfg = TYPE_BADGES[type] || TYPE_BADGES.class;
    return (
        <span style={{
            padding: '2px 8px', borderRadius: 100, fontSize: '0.62rem',
            fontWeight: 700, letterSpacing: '0.06em',
            background: cfg.bg, color: cfg.color,
        }}>{cfg.label}</span>
    );
}

export default function FacultyTimetable() {
    const [schedule, setSchedule] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [today] = useState(() => {
        const d = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        return d[new Date().getDay()];
    });

    useEffect(() => {
        (async () => {
            try {
                const r = await api.get('/faculty/my-schedule');
                setSchedule(r.data);
            } catch (e) {
                setError(e.response?.data?.error || 'Failed to load timetable');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    if (error) return (
        <DashboardLayout>
            <div style={{ padding: 32, textAlign: 'center', color: '#DC2626' }}>{error}</div>
        </DashboardLayout>
    );

    const totalSlots = schedule?.total_slots || 0;
    const sections = schedule?.sections_teaching || [];
    const scheduleByDay = schedule?.schedule || {};

    // Today's total classes
    const todaySlots = scheduleByDay[today] || [];

    return (
        <DashboardLayout>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
                .slot-card { animation: fadeIn 0.2s ease both; }
                .tt-scroll { overflow-x: auto; scrollbar-width: thin; }
                .tt-scroll::-webkit-scrollbar { height: 4px; }
                .tt-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
            `}</style>

            {/* ── Header ── */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    📅 My Timetable
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    Your weekly class schedule — set by HOD across all departments
                </p>
            </div>

            {/* ── Summary Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                    { icon: '📚', label: 'Total Classes/Week', value: totalSlots },
                    { icon: '📆', label: `Today (${today.substring(0,3)})`, value: todaySlots.length > 0 ? `${todaySlots.length} classes` : 'No classes' },
                    { icon: '🏛', label: 'Sections Teaching', value: sections.length },
                ].map(c => (
                    <div key={c.label} style={{
                        borderRadius: 12, padding: '14px 16px',
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-sm)',
                    }}>
                        <p style={{ fontSize: '1.4rem', marginBottom: 4 }}>{c.icon}</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{c.value}</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{c.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Sections list ── */}
            {sections.length > 0 && (
                <div style={{ marginBottom: 20, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, marginRight: 4 }}>TEACHING:</span>
                    {sections.map(s => (
                        <span key={s} style={{
                            padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                            background: 'rgba(21,101,192,0.08)', color: '#1565C0', border: '1px solid rgba(21,101,192,0.2)',
                        }}>{s}</span>
                    ))}
                </div>
            )}

            {/* ── No data state ── */}
            {totalSlots === 0 && (
                <div style={{
                    borderRadius: 16, padding: '60px 24px', textAlign: 'center',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>📭</div>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                        No classes scheduled yet
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Your HOD needs to add you to the timetable. Once they set your classes, they'll appear here automatically.
                    </p>
                </div>
            )}

            {/* ── Day Rows ── */}
            {totalSlots > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {DAYS.map(day => {
                        const slots = scheduleByDay[day] || [];
                        const dc = DAY_COLORS[day];
                        const isToday = day === today;

                        return (
                            <div key={day} style={{
                                borderRadius: 14, overflow: 'hidden',
                                background: 'var(--bg-card)', border: `1px solid ${isToday ? dc.main + '55' : 'var(--border)'}`,
                                boxShadow: isToday ? `0 2px 12px ${dc.main}22` : 'var(--shadow-sm)',
                            }}>
                                {/* Day Header */}
                                <div style={{
                                    padding: '10px 20px',
                                    background: isToday ? dc.grad : 'var(--bg-secondary)',
                                    borderBottom: '1px solid var(--border)',
                                    display: 'flex', alignItems: 'center', gap: 12,
                                }}>
                                    <span style={{
                                        fontSize: '0.875rem', fontWeight: 800,
                                        color: isToday ? 'white' : 'var(--text-primary)',
                                        minWidth: 96,
                                    }}>
                                        {day}
                                        {isToday && (
                                            <span style={{
                                                marginLeft: 8, fontSize: '0.65rem', fontWeight: 700,
                                                background: 'rgba(255,255,255,0.25)', borderRadius: 4,
                                                padding: '1px 6px', letterSpacing: '0.05em',
                                            }}>TODAY</span>
                                        )}
                                    </span>
                                    <span style={{
                                        fontSize: '0.72rem',
                                        color: isToday ? 'rgba(255,255,255,0.8)' : 'var(--text-tertiary)',
                                    }}>
                                        {slots.length === 0 ? 'No classes' : `${slots.length} class${slots.length > 1 ? 'es' : ''}`}
                                    </span>
                                </div>

                                {/* Slots row — horizontal scroll */}
                                {slots.length === 0 ? (
                                    <div style={{ padding: '18px 20px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                                        No classes scheduled
                                    </div>
                                ) : (
                                    <div className="tt-scroll" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                        {slots.map((slot, idx) => {
                                            const typeColor = slot.type === 'lab' ? '#2E7D32' : '#1565C0';
                                            return (
                                                <div key={idx} className="slot-card" style={{
                                                    minWidth: 160, maxWidth: 190, borderRadius: 10,
                                                    border: '1.5px solid var(--border)',
                                                    background: slot.type === 'lab'
                                                        ? 'rgba(46,125,50,0.04)'
                                                        : 'var(--bg-secondary)',
                                                    padding: '10px 12px',
                                                    boxShadow: 'var(--shadow-sm)',
                                                    borderLeft: `3px solid ${typeColor}`,
                                                    animationDelay: `${idx * 0.04}s`,
                                                }}>
                                                    {/* Period + time + badge */}
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <span style={{
                                                            fontSize: '0.68rem', fontWeight: 700, fontFamily: 'monospace',
                                                            color: 'var(--text-tertiary)',
                                                        }}>
                                                            P{slot.period}
                                                            {slot.startTime ? ` · ${slot.startTime}` : ''}
                                                            {slot.endTime ? `–${slot.endTime}` : ''}
                                                        </span>
                                                        <TypeBadge type={slot.type} />
                                                    </div>

                                                    {/* Subject */}
                                                    <p style={{
                                                        fontSize: '0.83rem', fontWeight: 700,
                                                        color: 'var(--text-primary)',
                                                        lineHeight: 1.25, marginBottom: 4,
                                                    }}>
                                                        {slot.subject}
                                                    </p>

                                                    {/* Section + dept */}
                                                    <p style={{ fontSize: '0.71rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: slot.room ? 3 : 0 }}>
                                                        Y{slot.year} · Sec {slot.section}
                                                        <br />{slot.dept_name}
                                                    </p>

                                                    {/* Room */}
                                                    {slot.room && (
                                                        <p style={{
                                                            fontSize: '0.7rem', color: 'var(--text-tertiary)',
                                                            marginTop: 4, display: 'flex', alignItems: 'center', gap: 3,
                                                        }}>
                                                            🏛 {slot.room}
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Note ── */}
            {totalSlots > 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 20, textAlign: 'center' }}>
                    🔄 This timetable is managed by your HOD. Changes will appear automatically when the HOD updates the schedule.
                </p>
            )}
        </DashboardLayout>
    );
}
