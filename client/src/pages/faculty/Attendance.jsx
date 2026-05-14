import { useState, useEffect, useCallback } from 'react';
import useNetworkStatus from '../../hooks/useNetworkStatus';
import { savePendingAttendance, countUnsynced, getAllOfflineEntries } from '../../utils/offlineAttendance';
import { runSync } from '../../utils/syncService';
import DashboardLayout from '../../components/DashboardLayout';
import { timeToMinutes } from '../../data/timetableData';

// ─── Helpers ──────────────────────────────────────────────────────────────
function pad2(n) { return String(n).padStart(2, '0'); }
function nowHHMM() { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function todayISO() { return new Date().toLocaleDateString('en-CA'); } // local date (matches server IST)
function fmtTime(t) {
    if (!t) return '—';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${pad2(m)} ${ampm}`;
}

async function apiFetch(path) {
    const res = await fetch(path, { credentials: 'include' });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

// ─── Toast ────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onDone }) {
    useEffect(() => { const t = setTimeout(onDone, 5000); return () => clearTimeout(t); }, [onDone]);
    const bg = type === 'warn' ? '#B45309' : '#2E7D32';
    return (
        <div style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
            background: bg, color: 'white', borderRadius: 12,
            padding: '14px 22px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            fontSize: '0.875rem', fontWeight: 600, maxWidth: 400,
            animation: 'slideUp 0.3s ease',
        }}>{message}</div>
    );
}

// ─── Type / Status Badges ─────────────────────────────────────────────────
function TypeBadge({ type }) {
    const cfg = {
        class: { label: 'CLASS', bg: 'rgba(21,101,192,0.12)', color: '#1565C0' },
        lab:   { label: 'LAB',   bg: 'rgba(46,125,50,0.12)',  color: '#2E7D32' },
        free:  { label: 'FREE',  bg: 'rgba(100,100,100,0.1)', color: '#616161' },
    }[type] || { label: 'CLASS', bg: 'rgba(21,101,192,0.12)', color: '#1565C0' };
    return <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', background: cfg.bg, color: cfg.color }}>{cfg.label}</span>;
}
function StatusBadge({ status }) {
    const cfg = {
        done:    { label: '✅ Done',    bg: 'rgba(46,125,50,0.1)',   color: '#2E7D32' },
        pending: { label: '🔴 Pending', bg: 'rgba(220,38,38,0.08)', color: '#DC2626' },
    }[status] || { label: 'N/A', bg: 'transparent', color: '#9E9E9E' };
    return <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>{cfg.label}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PERIOD SELECTOR  — step shown after clicking an assignment card
// ═══════════════════════════════════════════════════════════════════════════
function PeriodSelector({ assignment, onSelect, onBack, savedSessions, onSessionsRefresh }) {
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const currentTime = nowHHMM();
    const curMins = timeToMinutes(currentTime);

    useEffect(() => {
        const CACHE_KEY = 'vimp_periods_cache';
        const isOnline  = navigator.onLine;

        // Try to load from cache immediately so UI shows something even if offline
        let cachedPeriods = [];
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) cachedPeriods = JSON.parse(raw);
        } catch { /* ignore */ }

        if (!isOnline) {
            // ── OFFLINE: use cached periods, skip lock-status check ──────────
            if (cachedPeriods.length > 0) {
                // Strip any lock info — when offline we allow all periods
                setPeriods(cachedPeriods.map(p => ({ ...p, locked_by_me: false, locked_by_other: false, locked_by_name: null })));
            }
            setLoading(false);
            return;
        }

        // ── ONLINE: fetch fresh + update cache ───────────────────────────────
        const statusUrl = `/api/faculty/sessions/class-periods-status?assignment_id=${assignment.id}&date=${todayISO()}`;
        Promise.all([
            apiFetch('/api/faculty/active-periods'),
            apiFetch(statusUrl).catch(() => ({ periods: [] })),
        ])
            .then(([activePeriods, statusData]) => {
                const activePeriodsList = activePeriods.periods || [];
                const statusPeriods = statusData.periods || [];
                // Save fresh periods to cache for offline use
                try { localStorage.setItem(CACHE_KEY, JSON.stringify(activePeriodsList)); } catch { /* ignore */ }
                // Build lock-status map by period_number
                const lockMap = {};
                statusPeriods.forEach(sp => { lockMap[sp.period_number] = sp; });
                // Merge lock info into active periods list
                const merged = activePeriodsList.map(p => ({
                    ...p,
                    locked_by_me:    lockMap[p.period_number]?.locked_by_me    ?? false,
                    locked_by_other: lockMap[p.period_number]?.locked_by_other ?? false,
                    locked_by_name:  lockMap[p.period_number]?.locked_by_name  ?? null,
                }));
                setPeriods(merged);
            })
            .catch(() => {
                // Network failed even though navigator.onLine said true — use cache
                if (cachedPeriods.length > 0) {
                    setPeriods(cachedPeriods.map(p => ({ ...p, locked_by_me: false, locked_by_other: false, locked_by_name: null })));
                }
            })
            .finally(() => setLoading(false));
    }, [assignment.id]);


    const toMins = (t) => {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    const isCurrentPeriod = (p) => {
        const start = toMins(p.start_time);
        const end   = toMins(p.end_time);
        return curMins >= start && curMins <= end;
    };
    const isPast     = (p) => curMins > toMins(p.end_time);

    const periodStatus = (p) => {
        if (isCurrentPeriod(p)) return { label: '🟢 Now',      color: '#16A34A', bg: 'rgba(22,163,74,0.1)',    border: 'rgba(22,163,74,0.35)' };
        if (isPast(p))           return { label: '✔ Past',      color: '#6B7280', bg: 'rgba(107,114,128,0.07)', border: 'rgba(107,114,128,0.2)' };
        return                          { label: '⏳ Upcoming', color: '#B45309', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)' };
    };

    // Build a map: period_number → session info
    const savedMap = {};
    (savedSessions || []).forEach(s => { savedMap[s.period_number] = s; });
    const savedCount = Object.keys(savedMap).length;

    return (
        <div>
            {/* Back */}
            <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-secondary)', fontSize: '0.83rem', fontWeight: 600, padding: '0 0 18px 0' }}>
                ← Back to Classes
            </button>

            {/* Assignment info bar */}
            <div style={{ padding: '16px 20px', borderRadius: 12, marginBottom: 22, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'rgba(21,101,192,0.1)', border: '1.5px solid rgba(21,101,192,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#1565C0' }}>
                    {assignment.year}{assignment.section}
                </div>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{assignment.subject_name}</span>
                        <TypeBadge type="class" />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Year {assignment.year} · Section {assignment.section} · {assignment.dept_name}
                    </p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>🕐 Now: {fmtTime(currentTime)} · {todayISO()}</span>
                    {savedCount > 0 && (
                        <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(22,163,74,0.12)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.3)' }}>
                            ✅ {savedCount} period{savedCount > 1 ? 's' : ''} saved today
                        </span>
                    )}
                </div>
            </div>

            {/* Heading */}
            <div style={{ marginBottom: 14 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>Select Period to Mark Attendance</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {savedCount > 0
                        ? `${savedCount} period${savedCount > 1 ? 's' : ''} already saved — click any period to mark or re-mark.`
                        : 'Choose the class period slot. You can mark for any period — past, current, or upcoming.'}
                </p>
            </div>

            {loading ? (
                <div style={{ padding: 32, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>Loading periods…</p>
                </div>
            ) : periods.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>⚙️</p>
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>No periods configured yet</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: 4 }}>Ask the HOD to set up class periods from the Class Periods page.</p>
                </div>
            ) : (
                <>
                    {/* Period card grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
                        {periods.map(p => {
                            const st             = periodStatus(p);
                            const isSelected     = selected?.period_number === p.period_number;
                            const savedInfo      = savedMap[p.period_number];
                            const isSaved        = !!savedInfo;
                            const lockedByOther  = !!p.locked_by_other;
                            const canClick       = !lockedByOther;
                            return (
                                <div
                                    key={p.id}
                                    title={lockedByOther ? `Attendance for this period was already marked by ${p.locked_by_name}. Contact HOD to override.` : undefined}
                                    onClick={() => canClick && setSelected(p)}
                                    style={{
                                        padding: '16px 18px', borderRadius: 14,
                                        cursor: lockedByOther ? 'not-allowed' : 'pointer',
                                        opacity: lockedByOther ? 0.55 : 1,
                                        background: lockedByOther
                                            ? 'rgba(220,38,38,0.04)'
                                            : isSelected
                                                ? 'rgba(21,101,192,0.08)'
                                                : isSaved ? 'rgba(22,163,74,0.04)' : 'var(--bg-card)',
                                        border: `2px solid ${
                                            lockedByOther ? 'rgba(220,38,38,0.4)'
                                            : isSelected  ? '#1565C0'
                                            : isSaved     ? 'rgba(22,163,74,0.4)'
                                            : st.border}`,
                                        boxShadow: isSelected ? '0 0 0 3px rgba(21,101,192,0.15)' : 'var(--shadow-sm)',
                                        transition: 'all 0.18s ease',
                                        position: 'relative',
                                        userSelect: 'none',
                                    }}
                                    onMouseEnter={e => { if (!isSelected && !lockedByOther) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    {/* 🔒 Locked-by-other badge */}
                                    {lockedByOther && (
                                        <div style={{ position: 'absolute', top: 10, right: 10, padding: '2px 8px', borderRadius: 7, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', fontSize: '0.66rem', fontWeight: 800, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            🔒 {p.locked_by_name}
                                        </div>
                                    )}
                                    {/* Selected tick */}
                                    {isSelected && !lockedByOther && (
                                        <div style={{ position: 'absolute', top: 10, right: 12, width: 20, height: 20, borderRadius: '50%', background: '#1565C0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 800 }}>✓</span>
                                        </div>
                                    )}
                                    {/* Saved badge (top-right, only if NOT selected and NOT locked-by-other) */}
                                    {isSaved && !isSelected && !lockedByOther && (
                                        <div style={{ position: 'absolute', top: 10, right: 10, padding: '2px 8px', borderRadius: 7, background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.35)', fontSize: '0.66rem', fontWeight: 800, color: '#16A34A' }}>
                                            ✅ Saved · {savedInfo.student_count} students
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                            background: lockedByOther ? 'rgba(220,38,38,0.1)'
                                                      : isSelected    ? '#1565C0'
                                                      : isSaved       ? 'rgba(22,163,74,0.15)' : st.bg,
                                            border: `1.5px solid ${
                                                lockedByOther ? 'rgba(220,38,38,0.4)'
                                                : isSelected  ? '#1565C0'
                                                : isSaved     ? 'rgba(22,163,74,0.4)' : st.border}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: lockedByOther ? '#DC2626' : isSelected ? 'white' : isSaved ? '#16A34A' : st.color }}>P{p.period_number}</span>
                                        </div>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 800, color: lockedByOther ? '#DC2626' : isSelected ? '#1565C0' : 'var(--text-primary)', fontSize: '0.88rem' }}>
                                                Period {p.period_number}{p.label ? ` — ${p.label}` : ''}
                                            </p>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: st.color, background: st.bg, padding: '1px 6px', borderRadius: 6 }}>{st.label}</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontFamily: 'monospace', fontWeight: 600 }}>
                                        {fmtTime(p.start_time)} → {fmtTime(p.end_time)}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                                        Window: opens {p.window_open_before ?? 5}m before · closes {p.window_close_after ?? 10}m after
                                    </div>
                                    {/* Lock hint */}
                                    {lockedByOther && (
                                        <div style={{ marginTop: 8, fontSize: '0.68rem', color: '#DC2626', fontWeight: 600 }}>
                                            Taken by {p.locked_by_name} — contact HOD to override
                                        </div>
                                    )}
                                    {/* Re-mark hint if saved */}
                                    {isSaved && !lockedByOther && (
                                        <div style={{ marginTop: 8, fontSize: '0.68rem', color: '#16A34A', fontWeight: 600 }}>
                                            Click to re-mark / edit this period
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Proceed button */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => selected && onSelect(selected)}
                            disabled={!selected}
                            style={{
                                padding: '12px 32px', borderRadius: 12, border: 'none',
                                background: selected ? 'linear-gradient(135deg,#1565C0,#42A5F5)' : 'var(--border)',
                                color: selected ? 'white' : 'var(--text-tertiary)',
                                fontWeight: 700, fontSize: '0.9rem',
                                cursor: selected ? 'pointer' : 'not-allowed',
                                boxShadow: selected ? '0 4px 14px rgba(21,101,192,0.35)' : 'none',
                                transition: 'all 0.18s ease',
                            }}
                        >
                            {selected
                                ? (savedMap[selected.period_number]
                                    ? `Re-mark Period ${selected.period_number} (${fmtTime(selected.start_time)})`
                                    : `Continue → Period ${selected.period_number} (${fmtTime(selected.start_time)})`)
                                : 'Select a Period to Continue'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTENDANCE GRID  — shown after period is selected
// ═══════════════════════════════════════════════════════════════════════════
function AttendanceGrid({ assignment, period, onSave, onBack, isOnline = true, onOfflineSave }) {
    const [students, setStudents] = useState([]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);

    const currentTime = nowHHMM();
    const curMins = timeToMinutes(currentTime);
    const pStart = timeToMinutes(period.start_time);
    const pEnd   = timeToMinutes(period.end_time);
    const inSlot = curMins >= pStart && curMins <= pEnd;

    useEffect(() => {
        setLoading(true);
        apiFetch(`/api/faculty/students/${assignment.id}`)
            .then(data => {
                const studs = data.students || [];
                setStudents(studs);
                setRecords(studs.map(s => ({ student_id: s.student_id, roll_number: s.roll_number, full_name: s.full_name, status: 'present' })));
            })
            .catch(err => setError('Failed to load students: ' + err.message))
            .finally(() => setLoading(false));
    }, [assignment.id]);

    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount  = records.filter(r => r.status === 'absent').length;
    const setStatus    = (sid, s) => setRecords(prev => prev.map(r => r.student_id === sid ? { ...r, status: s } : r));
    const markAll      = (s) => setRecords(prev => prev.map(r => ({ ...r, status: s })));

    const handleSave = async () => {
        if (records.length === 0) return alert('No students to mark attendance for.');

        // ── OFFLINE PATH ─────────────────────────────────────────────────────
        if (!isOnline) {
            setSaving(true);
            try {
                await savePendingAttendance({
                    assignment_id: assignment.id,
                    session_date:  todayISO(),
                    period_number: period.period_number,
                    start_time:    period.start_time,
                    end_time:      period.end_time,
                    records:       records.map(r => ({ student_id: r.student_id, roll_number: r.roll_number, full_name: r.full_name, status: r.status })),
                    subject_name:  assignment.subject_name,
                    year:          assignment.year,
                    section:       assignment.section,
                    dept_name:     assignment.dept_name,
                });
                onOfflineSave?.();
                onSave(assignment.id, false, null, true); // wasOfflineSave = true
            } catch (err) {
                alert('Failed to save offline: ' + err.message);
            } finally { setSaving(false); }
            return;
        }

        // ── ONLINE PATH ──────────────────────────────────────────────────────
        setSaving(true);
        try {
            // 1. Create session with selected period's times
            const sessionRes = await fetch('/api/faculty/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    assignment_id:  assignment.id,
                    session_date:   todayISO(),
                    period_number:  period.period_number,
                    start_time:     period.start_time,
                    end_time:       period.end_time,
                }),
            });

            // ── Handle 409: another faculty already took this period ──
            if (sessionRes.status === 409) {
                const errData = await sessionRes.json().catch(() => ({}));
                const takenBy = errData.taken_by || 'another faculty member';
                alert(`⛔ Cannot save: Period ${period.period_number} attendance was already marked by ${takenBy}. Contact the HOD to override.`);
                setSaving(false);
                return;
            }

            let sessionId = null;
            let outsideWindow = false;
            let windowNote = null;

            if (sessionRes.ok) {
                const sData = await sessionRes.json();
                sessionId = sData.session_id;
            }

            if (sessionId) {
                const attRes = await fetch(`/api/faculty/sessions/${sessionId}/attendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ records: records.map(r => ({ student_id: r.student_id, status: r.status })) }),
                });
                if (attRes.ok) {
                    const attData = await attRes.json();
                    outsideWindow = attData.outside_window || false;
                    windowNote    = attData.window_note || null;
                } else {
                    const errData = await attRes.json().catch(() => ({}));
                    throw new Error(errData.error || `Server error ${attRes.status}`);
                }
            } else {
                // Fallback: direct attendance
                await fetch('/api/faculty/attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        assignment_id: assignment.id,
                        date: todayISO(),
                        records: records.map(r => ({ student_id: r.student_id, status: r.status })),
                    }),
                });
            }

            onSave(assignment.id, outsideWindow, windowNote);
        } catch (err) {
            alert('Failed to save attendance: ' + err.message);
        } finally { setSaving(false); }
    };

    const timeBg    = inSlot ? 'rgba(22,163,74,0.08)'  : 'rgba(245,158,11,0.08)';
    const timeBdr   = inSlot ? 'rgba(22,163,74,0.3)'   : 'rgba(245,158,11,0.3)';
    const timeColor = inSlot ? '#16A34A' : '#B45309';

    return (
        <div>
            <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-secondary)', fontSize: '0.83rem', fontWeight: 600, padding: '0 0 16px 0' }}>
                ← Change Period
            </button>

            {/* Info bar */}
            <div style={{ padding: '16px 20px', borderRadius: 12, marginBottom: 16, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{assignment.subject_name}</h2>
                        <TypeBadge type="class" />
                        {/* Period badge */}
                        <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: '0.68rem', fontWeight: 800, background: 'rgba(21,101,192,0.12)', color: '#1565C0', letterSpacing: '0.04em' }}>
                            P{period.period_number}{period.label ? ` · ${period.label}` : ''}
                        </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Year {assignment.year} · Section {assignment.section} · {fmtTime(period.start_time)}–{fmtTime(period.end_time)}
                    </p>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', margin: '2px 0 0' }}>{todayISO()}</p>
                </div>
                <div style={{ padding: '8px 16px', borderRadius: 10, background: timeBg, border: `1.5px solid ${timeBdr}`, color: timeColor, fontSize: '0.78rem', fontWeight: 700 }}>
                    {inSlot ? '✅ Within period window' : '⚠ Outside period window'}
                </div>
            </div>

            {/* Outside-window info note */}
            {!inSlot && (
                <div style={{ padding: '12px 18px', borderRadius: 10, marginBottom: 16, background: 'rgba(245,158,11,0.07)', border: '1.5px solid rgba(245,158,11,0.25)', display: 'flex', gap: 10 }}>
                    <span>ℹ️</span>
                    <div>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#B45309' }}>
                            Marking outside window — will be flagged in audit logs
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.77rem', color: '#78350F' }}>
                            Period window: {fmtTime(period.start_time)}–{fmtTime(period.end_time)} · Now: {fmtTime(currentTime)} · <strong>Saving is still allowed.</strong>
                        </p>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>Loading students…</p>
                </div>
            ) : error ? (
                <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.3)', color: '#DC2626', fontWeight: 600 }}>{error}</div>
            ) : students.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No students found for Year {assignment.year} Section {assignment.section}.</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: 6 }}>Add students from HOD → Students page.</p>
                </div>
            ) : (
                <>
                    {/* Controls */}
                    <div style={{ padding: '14px 20px', borderRadius: 12, marginBottom: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                        <div>
                            <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 6 }}>Bulk Actions</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => markAll('present')} style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #16A34A', background: 'rgba(22,163,74,0.08)', color: '#15803D', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>✓ All Present</button>
                                <button onClick={() => markAll('absent')}  style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #DC2626', background: 'rgba(220,38,38,0.08)', color: '#DC2626', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>✗ All Absent</button>
                            </div>
                        </div>
                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                            <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 4 }}>Live Count</p>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <span style={{ fontWeight: 700, color: '#16A34A', fontSize: '0.9rem' }}>✓ {presentCount} Present</span>
                                <span style={{ fontWeight: 700, color: '#DC2626', fontSize: '0.9rem' }}>✗ {absentCount} Absent</span>
                            </div>
                        </div>
                    </div>

                    {/* Student table */}
                    <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', marginBottom: 20 }}>
                        <table className="data-table">
                            <thead><tr><th>Roll No</th><th>Name</th><th>Status</th></tr></thead>
                            <tbody>
                                {records.map(r => (
                                    <tr key={r.student_id} style={{ background: r.status === 'absent' ? 'rgba(220,38,38,0.03)' : undefined }}>
                                        <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.roll_number}</span></td>
                                        <td><span style={{ fontWeight: 500 }}>{r.full_name}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {['present', 'absent'].map(s => {
                                                    const active = r.status === s;
                                                    return (
                                                        <button key={s} onClick={() => setStatus(r.student_id, s)} style={{
                                                            padding: '5px 18px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
                                                            background: active ? (s === 'present' ? '#16A34A' : '#DC2626') : 'transparent',
                                                            color: active ? 'white' : 'var(--text-secondary)',
                                                            border: `1.5px solid ${active ? (s === 'present' ? '#16A34A' : '#DC2626') : 'var(--border)'}`,
                                                            cursor: 'pointer', transition: 'all 0.15s ease',
                                                        }}>
                                                            {s === 'present' ? 'P' : 'A'}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Save */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={handleSave} disabled={saving} style={{
                            padding: '12px 32px', borderRadius: 12, border: 'none',
                            background: saving ? 'var(--border)' : isOnline ? 'linear-gradient(135deg,#1565C0,#42A5F5)' : 'linear-gradient(135deg,#B45309,#F59E0B)',
                            color: 'white', fontSize: '0.9rem', fontWeight: 700,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            boxShadow: saving ? 'none' : '0 4px 14px rgba(21,101,192,0.35)',
                        }}>
                            {saving ? 'Saving…' : isOnline ? `Save Attendance — ${presentCount} Present · ${absentCount} Absent` : `📵 Save Offline — ${presentCount} Present · ${absentCount} Absent`}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSIGNMENT CARD  — in the list view
// ═══════════════════════════════════════════════════════════════════════════
function AssignmentCard({ assignment, periodsDone, onClick }) {
    const hasSome = periodsDone > 0;
    return (
        <div
            onClick={onClick}
            style={{
                padding: '16px 20px', borderRadius: 14,
                background: 'var(--bg-card)',
                border: `1.5px solid ${hasSome ? 'rgba(46,125,50,0.3)' : 'rgba(220,38,38,0.25)'}`,
                boxShadow: 'var(--shadow-sm)',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: hasSome ? 'rgba(22,163,74,0.1)' : 'var(--bg-secondary)', border: `1.5px solid ${hasSome ? 'rgba(22,163,74,0.3)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: hasSome ? '#16A34A' : 'var(--text-secondary)' }}>
                {assignment.year}{assignment.section}
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>{assignment.subject_name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{assignment.subject_code}</span>
                </div>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Year {assignment.year} · Section {assignment.section} · {assignment.dept_name}
                </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.75rem', color: '#1565C0', fontWeight: 600 }}>Select period →</span>
                {hasSome ? (
                    <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(22,163,74,0.1)', color: '#2E7D32', whiteSpace: 'nowrap' }}>
                        ✅ {periodsDone} period{periodsDone > 1 ? 's' : ''} done
                    </span>
                ) : (
                    <StatusBadge status="pending" />
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTENDANCE OVERVIEW  — Student Overview tab
// ═══════════════════════════════════════════════════════════════════════════
function AttendanceOverview({ assignments }) {
    const [selectedId, setSelectedId] = useState(assignments[0]?.id || null);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!selectedId) return;
        setLoading(true); setError(null);
        apiFetch(`/api/faculty/attendance/percentage/${selectedId}`)
            .then(d => setStudents(d.students || []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [selectedId]);

    const selected = assignments.find(a => a.id === selectedId);
    const pctColor = (p) => p >= 75 ? '#16A34A' : p >= 60 ? '#B45309' : '#DC2626';

    return (
        <div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                {assignments.map(a => (
                    <button key={a.id} onClick={() => setSelectedId(a.id)} style={{
                        padding: '8px 16px', borderRadius: 10,
                        border: `1.5px solid ${selectedId === a.id ? 'var(--primary)' : 'var(--border)'}`,
                        background: selectedId === a.id ? 'rgba(21,101,192,0.1)' : 'var(--bg-card)',
                        color: selectedId === a.id ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                    }}>
                        {a.subject_name} · Y{a.year}{a.section}
                    </button>
                ))}
            </div>

            {selected && students.length > 0 && (
                <div style={{ padding: '12px 18px', borderRadius: 12, marginBottom: 18, background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                        <p style={{ margin: 0, fontWeight: 800, color: 'var(--text-primary)', fontSize: '1rem' }}>{selected.subject_name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Year {selected.year} · Section {selected.section}</p>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
                        {[
                            { label: 'Total', value: students.length, color: 'var(--text-primary)' },
                            { label: '≥75% Good', value: students.filter(s => s.percentage >= 75).length, color: '#16A34A' },
                            { label: '60–74% Low', value: students.filter(s => s.percentage >= 60 && s.percentage < 75).length, color: '#B45309' },
                            { label: '<60% Critical', value: students.filter(s => s.percentage < 60).length, color: '#DC2626' },
                        ].map(({ label, value, color }) => (
                            <div key={label} style={{ textAlign: 'center' }}>
                                <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color }}>{value}</p>
                                <p style={{ margin: 0, fontSize: '0.62rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>Loading attendance data…</p>
                </div>
            ) : error ? (
                <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.3)', color: '#DC2626', fontWeight: 600 }}>{error}</div>
            ) : students.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>📊</p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>No attendance records yet</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 4 }}>Mark attendance from the "Mark Attendance" tab first.</p>
                </div>
            ) : (
                <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                    <table className="data-table">
                        <thead><tr><th>Roll No</th><th>Name</th><th>Attended</th><th>Total</th><th>Attendance %</th></tr></thead>
                        <tbody>
                            {students.map(s => (
                                <tr key={s.student_id}>
                                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.roll_number}</span></td>
                                    <td><span style={{ fontWeight: 500 }}>{s.full_name}</span></td>
                                    <td style={{ textAlign: 'center' }}>{s.attended}</td>
                                    <td style={{ textAlign: 'center' }}>{s.total_classes}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                                                <div style={{ width: `${Math.min(s.percentage, 100)}%`, height: '100%', borderRadius: 3, background: pctColor(s.percentage), transition: 'width 0.4s ease' }} />
                                            </div>
                                            <span style={{ fontWeight: 700, color: pctColor(s.percentage), minWidth: 44, textAlign: 'right', fontSize: '0.85rem' }}>{s.percentage}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// OFFLINE SYNC QUEUE — shown in Pending Sync tab
// ═══════════════════════════════════════════════════════════════════════════
function OfflineSyncQueue({ entries, isOnline, onManualSync, onRefresh }) {
    const [syncing, setSyncing] = useState(false);
    const statusColor = (e) => {
        if (e.conflict_flagged) return '#DC2626';
        if (e.synced)           return '#16A34A';
        return '#B45309';
    };
    const statusLabel = (e) => {
        if (e.conflict_flagged) return '⚠️ Conflict — flagged to HOD';
        if (e.synced)           return '✅ Synced';
        return '⏳ Pending';
    };
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Offline Sync Queue</h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                        Attendance saved while offline. Syncs automatically when internet returns.
                    </p>
                </div>
                <button
                    onClick={async () => { setSyncing(true); await onManualSync(); setSyncing(false); }}
                    disabled={syncing || !isOnline}
                    style={{ padding: '9px 20px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: isOnline ? 'pointer' : 'not-allowed', background: isOnline ? 'linear-gradient(135deg,#1565C0,#42A5F5)' : 'var(--border)', color: isOnline ? 'white' : 'var(--text-tertiary)', opacity: syncing ? 0.7 : 1 }}
                >
                    {syncing ? '🔄 Syncing…' : isOnline ? '🔄 Sync Now' : '📵 Offline'}
                </button>
            </div>
            {entries.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>✅</p>
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem' }}>No offline entries</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: 4 }}>All attendance has been synced to the server.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {entries.map(e => (
                        <div key={e.local_id} style={{ padding: '14px 18px', borderRadius: 12, background: 'var(--bg-card)', border: `1.5px solid ${e.conflict_flagged ? 'rgba(220,38,38,0.35)' : e.synced ? 'rgba(22,163,74,0.3)' : 'rgba(245,158,11,0.4)'}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 180 }}>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{e.subject_name} · P{e.period_number}</p>
                                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Y{e.year}{e.section} · {e.session_date} · {e.records?.length || 0} students</p>
                                {e.sync_error && <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: '#DC2626', fontWeight: 600 }}>{e.sync_error}</p>}
                            </div>
                            <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, background: e.conflict_flagged ? 'rgba(220,38,38,0.1)' : e.synced ? 'rgba(22,163,74,0.1)' : 'rgba(245,158,11,0.1)', color: statusColor(e) }}>
                                {statusLabel(e)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
const VIEW = { LIST: 'list', PERIOD: 'period', GRID: 'grid' };

export default function FacultyAttendance() {
    const [assignments, setAssignments]         = useState([]);
    const [loading, setLoading]                 = useState(true);
    const [error, setError]                     = useState(null);
    const [view, setView]                       = useState(VIEW.LIST);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [selectedPeriod, setSelectedPeriod]   = useState(null);
    const [savedSessionsMap, setSavedSessionsMap] = useState({});
    const [toast, setToast]                     = useState(null);
    const [activeTab, setActiveTab]             = useState('mark');
    // ── Offline / sync state ──────────────────────────────────────────────
    const { isOnline, wasOffline } = useNetworkStatus();
    const [pendingCount, setPendingCount]     = useState(0);
    const [offlineEntries, setOfflineEntries] = useState([]);

    useEffect(() => {
        const CACHE_KEY = 'vimp_assignments_cache';
        // Show cached assignments immediately while fetching
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) {
                const cached = JSON.parse(raw);
                if (cached.length > 0) setAssignments(cached);
            }
        } catch { /* ignore */ }

        if (!navigator.onLine) {
            // Offline from the start — use cache
            setLoading(false);
            return;
        }

        apiFetch('/api/faculty/assignments')
            .then(d => {
                const list = d.assignments || [];
                try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
                setAssignments(list);
            })
            .catch(err => setError('Failed to load: ' + err.message))
            .finally(() => setLoading(false));
    }, []);


    // Load (or refresh) today's sessions for a given assignment
    const refreshSessions = useCallback(async (assignmentId) => {
        try {
            const d = await apiFetch(`/api/faculty/sessions/today/${assignmentId}`);
            setSavedSessionsMap(prev => ({ ...prev, [assignmentId]: d.sessions || [] }));
        } catch { }
    }, []);

    const handleCardClick = useCallback((assignment) => {
        setSelectedAssignment(assignment);
        setSelectedPeriod(null);
        refreshSessions(assignment.id);  // load today's sessions for this class
        setView(VIEW.PERIOD);
    }, [refreshSessions]);

    const handlePeriodSelect = useCallback((period) => {
        setSelectedPeriod(period);
        setView(VIEW.GRID);
    }, []);

    // ── Refresh pending offline count ────────────────────────────────────
    // IMPORTANT: declared BEFORE handleSaveAttendance to avoid TDZ ReferenceError
    const refreshPendingCount = useCallback(async () => {
        try { setPendingCount(await countUnsynced()); } catch { }
    }, []);

    useEffect(() => { refreshPendingCount(); }, [refreshPendingCount]);

    const handleSaveAttendance = useCallback(async (assignmentId, outsideWindow, windowNote, wasOfflineSave = false) => {
        const a = assignments.find(x => x.id === assignmentId);
        const label = `${a?.subject_name || 'Subject'} · P${selectedPeriod?.period_number} · Y${a?.year} Sec ${a?.section}`;
        if (wasOfflineSave) {
            setToast({ message: `📵 Saved offline — ${label}. Will auto-sync when internet returns.`, type: 'warn' });
            await refreshPendingCount();
        } else if (outsideWindow && windowNote) {
            setToast({ message: `⚠ Saved (outside window) — ${label}. Pending HOD confirmation.`, type: 'warn' });
        } else {
            setToast({ message: `✅ Attendance saved — ${label}`, type: 'success' });
        }
        await refreshSessions(assignmentId);
        setSelectedPeriod(null);
        setView(VIEW.PERIOD);
    }, [assignments, selectedPeriod, refreshSessions, refreshPendingCount]);

    // Auto-sync when internet returns
    useEffect(() => {
        if (!wasOffline) return;
        setToast({ message: '🔄 Internet restored — syncing offline attendance…', type: 'warn' });
        runSync(({ synced, conflicts, phase }) => {
            if (phase !== 'done') return;
            refreshPendingCount();
            if (conflicts > 0)
                setToast({ message: `✅ Synced ${synced}. ⚠️ ${conflicts} conflict(s) flagged to HOD.`, type: 'warn' });
            else if (synced > 0)
                setToast({ message: `✅ ${synced} offline record(s) synced successfully!`, type: 'success' });
            else
                setToast(null);
        });
    }, [wasOffline, refreshPendingCount]);

    // Count saved periods per assignment
    const periodsDoneFor = (assignmentId) => (savedSessionsMap[assignmentId] || []).length;
    const totalDone = assignments.filter(a => periodsDoneFor(a.id) > 0).length;

    const tabStyle = (t) => ({
        padding: '8px 20px', borderRadius: 10, border: `1.5px solid ${activeTab === t ? 'var(--primary)' : 'var(--border)'}`,
        background: activeTab === t ? 'var(--primary)' : 'var(--bg-card)',
        color: activeTab === t ? 'white' : 'var(--text-secondary)',
        fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s ease',
    });

    return (
        <DashboardLayout>
            <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

            {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                        {view === VIEW.LIST ? 'Attendance' : view === VIEW.PERIOD ? 'Select Period' : 'Mark Attendance'}
                    </h1>
                    {/* Network status dot */}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 700, background: isOnline ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', color: isOnline ? '#16A34A' : '#DC2626', border: `1px solid ${isOnline ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}` }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: isOnline ? '#16A34A' : '#DC2626', display: 'inline-block' }} />
                        {isOnline ? 'Online' : 'Offline'}
                    </span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    {view === VIEW.LIST ? "Mark today's attendance or view student overview" : view === VIEW.PERIOD ? `${selectedAssignment?.subject_name} — choose which period to mark` : `Period ${selectedPeriod?.period_number} · ${fmtTime(selectedPeriod?.start_time)}–${fmtTime(selectedPeriod?.end_time)}`}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                    {view === VIEW.LIST && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 10, background: 'rgba(21,101,192,0.07)', border: '1px solid rgba(21,101,192,0.2)' }}>
                            <span style={{ fontSize: '0.82rem' }}>📅</span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1565C0' }}>
                                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>· Periods reset daily at midnight</span>
                        </div>
                    )}
                    {!isOnline && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700, background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.25)' }}>
                            📵 No internet — attendance will be saved locally
                        </span>
                    )}
                    {pendingCount > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700, background: 'rgba(245,158,11,0.1)', color: '#B45309', border: '1px solid rgba(245,158,11,0.35)' }}>
                            ⏳ {pendingCount} entry{pendingCount > 1 ? 's' : ''} pending sync
                        </span>
                    )}
                </div>
            </div>


            {/* Period Selector step */}
            {view === VIEW.PERIOD && selectedAssignment && (
                <PeriodSelector
                    assignment={selectedAssignment}
                    onSelect={handlePeriodSelect}
                    onBack={() => { setView(VIEW.LIST); setSelectedAssignment(null); }}
                    savedSessions={savedSessionsMap[selectedAssignment.id] || []}
                    onSessionsRefresh={() => refreshSessions(selectedAssignment.id)}
                />
            )}

            {/* Attendance Grid step */}
            {view === VIEW.GRID && selectedAssignment && selectedPeriod && (
                <AttendanceGrid
                    assignment={selectedAssignment}
                    period={selectedPeriod}
                    onSave={handleSaveAttendance}
                    onBack={() => setView(VIEW.PERIOD)}
                    isOnline={isOnline}
                    onOfflineSave={refreshPendingCount}
                />
            )}

            {/* List view */}
            {view === VIEW.LIST && (
                <>
                    {/* Summary cards */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                        {[
                            { label: 'Today', value: new Date().toLocaleDateString('en-IN', { weekday: 'long' }), color: 'var(--primary)' },
                            { label: 'Total Classes', value: assignments.length, color: 'var(--text-primary)' },
                            { label: 'Pending', value: assignments.length - totalDone, color: '#DC2626' },
                            { label: 'Classes with Attendance', value: totalDone, color: '#2E7D32' },
                        ].map(({ label, value, color }) => (
                            <div key={label} style={{ padding: '12px 18px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', minWidth: 110 }}>
                                <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', margin: '0 0 4px' }}>{label}</p>
                                <p style={{ fontSize: '1.1rem', fontWeight: 800, color, margin: 0 }}>{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                        <button style={tabStyle('mark')}     onClick={() => setActiveTab('mark')}>📋 Mark Attendance</button>
                        <button style={tabStyle('overview')} onClick={() => setActiveTab('overview')}>📊 Student Overview</button>
                        <button
                            style={{ ...tabStyle('pending'), ...(pendingCount > 0 ? { borderColor: '#B45309', color: activeTab === 'pending' ? 'white' : '#B45309', background: activeTab === 'pending' ? '#B45309' : 'var(--bg-card)' } : {}) }}
                            onClick={async () => { const e = await getAllOfflineEntries(); setOfflineEntries(e); await refreshPendingCount(); setActiveTab('pending'); }}
                        >
                            ⏳ Sync Queue{pendingCount > 0 ? ` (${pendingCount})` : ''}
                        </button>
                    </div>

                    {activeTab === 'pending' ? (
                        <OfflineSyncQueue
                            entries={offlineEntries}
                            isOnline={isOnline}
                            onRefresh={async () => { const e = await getAllOfflineEntries(); setOfflineEntries(e); await refreshPendingCount(); }}
                            onManualSync={async () => {
                                if (!isOnline) { setToast({ message: '📵 Still offline — sync will happen automatically when internet returns.', type: 'warn' }); return; }
                                setToast({ message: '🔄 Syncing…', type: 'warn' });
                                const result = await runSync(async () => { const e = await getAllOfflineEntries(); setOfflineEntries(e); await refreshPendingCount(); });
                                const e = await getAllOfflineEntries(); setOfflineEntries(e); await refreshPendingCount();
                                if (result.conflicts > 0) setToast({ message: `✅ Synced ${result.synced}. ⚠️ ${result.conflicts} conflict(s) flagged to HOD.`, type: 'warn' });
                                else setToast({ message: `✅ ${result.synced} record(s) synced!`, type: 'success' });
                            }}
                        />
                    ) : activeTab === 'mark' ? (
                        loading ? (
                            <div style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14 }}>
                                <p style={{ color: 'var(--text-secondary)' }}>Loading your assignments…</p>
                            </div>
                        ) : error ? (
                            <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.3)', color: '#DC2626', fontWeight: 600 }}>{error}</div>
                        ) : assignments.length === 0 ? (
                            <div style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14 }}>
                                <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>📋</p>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>No classes assigned yet</p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>The HOD needs to assign you to subjects from the Assign Classes page.</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {assignments.map(a => (
                                        <AssignmentCard
                                            key={a.id}
                                            assignment={a}
                                            periodsDone={periodsDoneFor(a.id)}
                                            onClick={() => handleCardClick(a)}
                                        />
                                    ))}
                                </div>
                                <div style={{ marginTop: 20, padding: '12px 18px', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', alignSelf: 'center' }}>Guide:</p>
                                    <span style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600 }}>🔴 Pending — click to select a period & mark</span>
                                    <span style={{ fontSize: '0.75rem', color: '#2E7D32', fontWeight: 600 }}>✅ N periods done — click to mark more periods</span>
                                </div>
                            </>
                        )
                    ) : (
                        assignments.length === 0 ? (
                            <div style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14 }}>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>No assignments to view overview for.</p>
                            </div>
                        ) : (
                            <AttendanceOverview assignments={assignments} />
                        )
                    )}
                </>
            )}
        </DashboardLayout>
    );
}
