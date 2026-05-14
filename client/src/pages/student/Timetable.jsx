import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { DAYS, timeToMinutes } from '../../data/timetableData';

const TODAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SUBJECT_COLORS = [
    { bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.35)',  text: '#6366F1' },
    { bg: 'rgba(20,184,166,0.1)',  border: 'rgba(20,184,166,0.35)',  text: '#0D9488' },
    { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.35)', text: '#D97706' },
    { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.35)',   text: '#DC2626' },
    { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.35)',   text: '#16A34A' },
    { bg: 'rgba(168,85,247,0.1)',  border: 'rgba(168,85,247,0.35)',  text: '#9333EA' },
    { bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.35)',  text: '#EA580C' },
    { bg: 'rgba(14,165,233,0.1)',  border: 'rgba(14,165,233,0.35)',  text: '#0284C7' },
];

export default function StudentTimetable() {
    const [timetableRows, setTimetableRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const scrollRef = useRef(null);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const [currentMins, setCurrentMins] = useState(() => {
        const n = new Date();
        return n.getHours() * 60 + n.getMinutes();
    });
    const intervalRef = useRef(null);
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            const n = new Date();
            setCurrentMins(n.getHours() * 60 + n.getMinutes());
        }, 30000);
        return () => clearInterval(intervalRef.current);
    }, []);

    useEffect(() => {
        fetch('/api/student/timetable', { credentials: 'include' })
            .then(r => { if (!r.ok) throw new Error('API error'); return r.json(); })
            .then(data => setTimetableRows(data.timetable || []))
            .catch(err => setError('Failed to load timetable: ' + err.message))
            .finally(() => setLoading(false));
    }, []);

    // Check scroll affordance
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const check = () => setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
        check();
        el.addEventListener('scroll', check);
        window.addEventListener('resize', check);
        return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
    }, [timetableRows]);

    const todayName = TODAY_NAMES[new Date().getDay()];

    // Build subject → color map
    const subjectColorMap = {};
    let colorIdx = 0;

    const grouped = {};
    DAYS.forEach(d => { grouped[d] = []; });
    timetableRows.forEach(row => {
        const day = row.day_of_week;
        if (grouped[day]) grouped[day].push(row);
        if (row.subject_name && !subjectColorMap[row.subject_name]) {
            subjectColorMap[row.subject_name] = SUBJECT_COLORS[colorIdx % SUBJECT_COLORS.length];
            colorIdx++;
        }
    });
    DAYS.forEach(d => {
        grouped[d].sort((a, b) => a.start_time.localeCompare(b.start_time));
    });

    const maxPeriods = Math.max(...DAYS.map(d => grouped[d].length), 0);
    const periodNums = maxPeriods > 0 ? Array.from({ length: maxPeriods }, (_, i) => i + 1) : [];

    const isActive = (slot) => {
        if (!slot) return false;
        return currentMins >= timeToMinutes(slot.start_time) && currentMins <= timeToMinutes(slot.end_time);
    };

    return (
        <DashboardLayout>
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 0 2px rgba(46,125,50,0.4), 0 0 12px rgba(46,125,50,0.2); }
                    50% { box-shadow: 0 0 0 3px rgba(46,125,50,0.6), 0 0 20px rgba(46,125,50,0.35); }
                }
                .active-slot { animation: pulse-glow 2s ease-in-out infinite !important; }
                .tt-wrap {
                    overflow-x: auto;
                    scrollbar-width: thin;
                    scrollbar-color: var(--border) transparent;
                    /* Break out of maxWidth constraint */
                    margin-left: -32px;
                    margin-right: -32px;
                    padding-left: 32px;
                    padding-right: 32px;
                    padding-bottom: 8px;
                }
                .tt-wrap::-webkit-scrollbar { height: 6px; }
                .tt-wrap::-webkit-scrollbar-track { background: transparent; }
                .tt-wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
                .tt-wrap::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }
                .tt-day-cell {
                    position: sticky;
                    left: 0;
                    z-index: 2;
                    background: var(--bg-card);
                }
                .tt-day-today .tt-day-cell { background: rgba(184,150,12,0.04); }
                .tt-head-day {
                    position: sticky;
                    left: 0;
                    z-index: 3;
                    background: var(--bg-secondary);
                }
                .tt-period-cell:hover { background: var(--sidebar-hover) !important; }
                .scroll-fade {
                    position: absolute;
                    right: 0;
                    top: 0;
                    bottom: 8px;
                    width: 48px;
                    background: linear-gradient(to right, transparent, var(--bg-primary));
                    pointer-events: none;
                    transition: opacity 0.3s;
                    border-radius: 0 14px 14px 0;
                }
                @media (max-width: 767px) {
                    .tt-wrap { margin-left: -16px; margin-right: -16px; padding-left: 16px; padding-right: 16px; }
                }
            `}</style>

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                    My Timetable
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Weekly class schedule · Today: <strong style={{ color: 'var(--text-primary)' }}>{todayName}</strong>
                    {maxPeriods > 0 && <span style={{ marginLeft: 12, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>· {maxPeriods} periods/day</span>}
                </p>
            </div>

            {loading ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: 10 }}>⏳</div>
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading timetable...</p>
                </div>
            ) : error ? (
                <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.3)', color: '#DC2626', fontWeight: 600 }}>{error}</div>
            ) : timetableRows.length === 0 ? (
                <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '1.5rem', marginBottom: 12 }}>📅</p>
                    <p style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>No timetable available yet</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>The HOD needs to build the timetable for your class.</p>
                </div>
            ) : (
                <>
                    {/* Legend + scroll hint */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 12, height: 12, borderRadius: 3, borderLeft: '4px solid #B8960C', background: 'rgba(184,150,12,0.1)' }} />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Today</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(46,125,50,0.2)', border: '2px solid #2E7D32' }} />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Now</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(34,197,94,0.15)', border: '1.5px solid rgba(34,197,94,0.4)' }} />
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>LAB</span>
                            </div>
                        </div>
                        {canScrollRight && (
                            <span style={{
                                fontSize: '0.72rem', color: 'var(--text-tertiary)', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', borderRadius: 8,
                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                                animation: 'fadeIn 0.3s ease',
                            }}>
                                ← Scroll to see all periods →
                            </span>
                        )}
                    </div>

                    {/* Scrollable timetable wrapper */}
                    <div style={{ position: 'relative' }}>
                        <div className="tt-wrap" ref={scrollRef}>
                            <div style={{
                                borderRadius: 14, overflow: 'hidden',
                                border: '1px solid var(--border)',
                                boxShadow: 'var(--shadow-sm)',
                                minWidth: 88 + maxPeriods * 160,
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                    <colgroup>
                                        <col style={{ width: 88 }} />
                                        {periodNums.map(n => <col key={n} style={{ width: 160 }} />)}
                                    </colgroup>
                                    <thead>
                                        <tr style={{ background: 'var(--bg-secondary)' }}>
                                            <th className="tt-head-day" style={{
                                                padding: '13px 14px', fontSize: '0.68rem', fontWeight: 700,
                                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                                color: 'var(--text-tertiary)', textAlign: 'left',
                                                borderBottom: '1.5px solid var(--border)', width: 88,
                                            }}>Day</th>
                                            {periodNums.map(n => (
                                                <th key={n} style={{
                                                    padding: '13px 10px', fontSize: '0.68rem', fontWeight: 700,
                                                    textTransform: 'uppercase', letterSpacing: '0.08em',
                                                    color: 'var(--text-tertiary)', textAlign: 'center',
                                                    borderBottom: '1.5px solid var(--border)',
                                                    borderLeft: '1px solid var(--border-light)',
                                                }}>
                                                    Period {n}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {DAYS.map((day, dayIdx) => {
                                            const slots = grouped[day];
                                            const isToday = day === todayName;

                                            return (
                                                <tr key={day}
                                                    className={isToday ? 'tt-day-today' : ''}
                                                    style={{
                                                        borderBottom: dayIdx < DAYS.length - 1 ? '1px solid var(--border-light)' : 'none',
                                                        background: isToday ? 'rgba(184,150,12,0.035)' : 'var(--bg-card)',
                                                    }}>
                                                    {/* Sticky Day Label */}
                                                    <td className="tt-day-cell" style={{
                                                        padding: '12px 10px', verticalAlign: 'middle', width: 88,
                                                        borderLeft: isToday ? '4px solid #B8960C' : '4px solid transparent',
                                                        borderRight: '1px solid var(--border-light)',
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        <div style={{
                                                            fontSize: '0.8rem', fontWeight: isToday ? 800 : 700,
                                                            color: isToday ? '#B8960C' : 'var(--text-secondary)',
                                                            letterSpacing: '0.04em',
                                                        }}>
                                                            {day.slice(0, 3).toUpperCase()}
                                                        </div>
                                                        {isToday && (
                                                            <div style={{
                                                                fontSize: '0.56rem', color: '#B8960C', fontWeight: 800,
                                                                marginTop: 3, letterSpacing: '0.08em',
                                                                padding: '1px 5px', borderRadius: 4,
                                                                background: 'rgba(184,150,12,0.12)',
                                                                display: 'inline-block',
                                                            }}>TODAY</div>
                                                        )}
                                                    </td>

                                                    {/* Period Cells */}
                                                    {periodNums.map(n => {
                                                        const slot = slots[n - 1];
                                                        const active = isToday && slot && isActive(slot);
                                                        const isLab = slot?.slot_type === 'lab';
                                                        const clr = slot ? (subjectColorMap[slot.subject_name] || SUBJECT_COLORS[0]) : null;

                                                        return (
                                                            <td key={n}
                                                                className="tt-period-cell"
                                                                style={{
                                                                    padding: '6px 8px',
                                                                    borderLeft: '1px solid var(--border-light)',
                                                                    verticalAlign: 'top',
                                                                    width: 160,
                                                                    transition: 'background 0.15s',
                                                                }}>
                                                                {slot ? (
                                                                    <div
                                                                        className={active ? 'active-slot' : ''}
                                                                        style={{
                                                                            padding: '9px 10px',
                                                                            borderRadius: 10,
                                                                            background: active
                                                                                ? 'rgba(46,125,50,0.12)'
                                                                                : isLab
                                                                                    ? 'rgba(34,197,94,0.06)'
                                                                                    : clr.bg,
                                                                            border: active
                                                                                ? '1.5px solid rgba(46,125,50,0.45)'
                                                                                : isLab
                                                                                    ? '1.5px solid rgba(34,197,94,0.35)'
                                                                                    : `1.5px solid ${clr.border}`,
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            gap: 3,
                                                                            height: '100%',
                                                                            minHeight: 80,
                                                                            transition: 'all 0.2s ease',
                                                                        }}
                                                                    >
                                                                        {/* Time */}
                                                                        <div style={{
                                                                            fontSize: '0.6rem',
                                                                            color: active ? '#1B5E20' : 'var(--text-tertiary)',
                                                                            fontFamily: 'monospace', fontWeight: 700,
                                                                            letterSpacing: '0.02em',
                                                                        }}>
                                                                            {slot.start_time} – {slot.end_time}
                                                                        </div>
                                                                        {/* Subject */}
                                                                        <p style={{
                                                                            fontSize: '0.78rem', fontWeight: 700, margin: 0,
                                                                            color: active ? '#1B5E20' : clr.text,
                                                                            lineHeight: 1.25,
                                                                        }}>
                                                                            {slot.subject_name}
                                                                        </p>
                                                                        {/* Faculty */}
                                                                        <p style={{
                                                                            fontSize: '0.68rem', color: 'var(--text-secondary)',
                                                                            margin: 0, fontWeight: 500,
                                                                        }}>
                                                                            {slot.faculty_name}
                                                                        </p>
                                                                        {/* Room + badges */}
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                                                                            {slot.room_number && (
                                                                                <span style={{
                                                                                    fontSize: '0.6rem', color: 'var(--text-tertiary)',
                                                                                    fontWeight: 600, padding: '1px 5px',
                                                                                    background: 'var(--bg-secondary)',
                                                                                    borderRadius: 4,
                                                                                }}>📍 {slot.room_number}</span>
                                                                            )}
                                                                            {isLab && (
                                                                                <span style={{
                                                                                    fontSize: '0.58rem', fontWeight: 800,
                                                                                    padding: '1px 6px', borderRadius: 4,
                                                                                    background: 'rgba(34,197,94,0.15)',
                                                                                    color: '#16A34A', letterSpacing: '0.05em',
                                                                                }}>LAB</span>
                                                                            )}
                                                                            {active && (
                                                                                <span style={{
                                                                                    fontSize: '0.58rem', fontWeight: 800,
                                                                                    padding: '1px 6px', borderRadius: 4,
                                                                                    background: 'rgba(46,125,50,0.15)',
                                                                                    color: '#166534', letterSpacing: '0.05em',
                                                                                }}>🟢 LIVE</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div style={{
                                                                        padding: '10px 8px', fontSize: '0.7rem',
                                                                        color: 'var(--text-tertiary)', textAlign: 'center',
                                                                        minHeight: 80, display: 'flex',
                                                                        alignItems: 'center', justifyContent: 'center',
                                                                    }}>—</div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {/* Fade overlay on right when scrollable */}
                        {canScrollRight && <div className="scroll-fade" />}
                    </div>

                    <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 14, textAlign: 'center' }}>
                        Timetable managed by your department HOD · Times shown in IST
                    </p>
                </>
            )}
        </DashboardLayout>
    );
}
