import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { DAYS } from '../../data/timetableData';

// ─── Constants ─────────────────────────────────────────────────────────────
const YEARS = [1, 2, 3, 4];
const SECTIONS = ['A', 'B', 'C'];
const DEPT = 'CSE';

// Fallback times (24-hour format) used only if PeriodsConfig has not been set up yet
const STD_TIMES = [
    { startTime: '09:00', endTime: '09:55' },
    { startTime: '09:55', endTime: '10:50' },
    { startTime: '11:10', endTime: '12:05' },
    { startTime: '12:05', endTime: '13:00' },
    { startTime: '14:00', endTime: '14:55' },
    { startTime: '14:55', endTime: '15:50' },
];

function sectionKey(year, section) {
    return `${DEPT}-${year}-${section}`;
}

// ─── API Helper ───────────────────────────────────────────────────────────
async function apiFetch(path) {
    const res = await fetch(path, { credentials: 'include' });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

// ─── Badge ───────────────────────────────────────────────────────────────
function TypeBadge({ type }) {
    const cfg = {
        class: { label: 'CLASS', bg: 'rgba(21,101,192,0.12)', color: '#1565C0' },
        lab: { label: 'LAB', bg: 'rgba(46,125,50,0.12)', color: '#2E7D32' },
        free: { label: 'FREE', bg: 'rgba(100,100,100,0.12)', color: '#616161' },
    }[type] || { label: 'CLASS', bg: 'rgba(21,101,192,0.12)', color: '#1565C0' };

    return (
        <span style={{
            padding: '2px 8px', borderRadius: 100, fontSize: '0.62rem',
            fontWeight: 700, letterSpacing: '0.06em',
            background: cfg.bg, color: cfg.color,
        }}>{cfg.label}</span>
    );
}

// ─── Slot Editor Modal ────────────────────────────────────────────────────
function SlotEditorModal({ isOpen, slot, day, periodIndex, subjects, faculty, getPeriodTime, onSave, onClear, onClose }) {
    const defaultForm = () => slot ? { ...slot } : (() => {
        const timing = getPeriodTime
            ? getPeriodTime(periodIndex ?? 0)
            : STD_TIMES[Math.min(periodIndex ?? 0, STD_TIMES.length - 1)];
        return {
            period: (periodIndex ?? 0) + 1,
            startTime: timing.startTime,
            endTime: timing.endTime,
            subject: '',
            subjectId: '',
            facultyId: '',
            facultyName: '',
            room: '',
            type: 'class',
        };
    })();

    const [form, setForm] = useState(defaultForm);

    useEffect(() => {
        if (isOpen) setForm(defaultForm());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, slot, periodIndex]);

    if (!isOpen) return null;

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubjectChange = (subjectId) => {
        const subj = subjects.find(s => String(s.id) === subjectId);
        setForm(f => ({
            ...f,
            subjectId,
            subject: subj ? subj.name : '',
            facultyId: '',
            facultyName: '',
        }));
    };

    const handleFacultyChange = (facId) => {
        const fac = faculty.find(f => String(f.id) === facId);
        setForm(f => ({ ...f, facultyId: facId, facultyName: fac ? fac.full_name : '' }));
    };

    const handleSave = () => {
        if (!form.startTime || !form.endTime) return alert('Please set period times');
        if (form.startTime >= form.endTime) return alert('End time must be after start time');
        if (form.type !== 'free' && (!form.subject || !form.facultyId)) return alert('Please select subject and faculty');
        onSave({ ...form });
    };

    const labelStyle = {
        fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 6, display: 'block',
    };
    const inputStyle = {
        width: '100%', padding: '9px 12px', borderRadius: 9,
        border: '1.5px solid var(--border)', background: 'var(--bg-secondary)',
        color: 'var(--text-primary)', fontSize: '0.85rem', boxSizing: 'border-box',
    };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.45)', animation: 'fadeIn 0.15s ease' }} />
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                zIndex: 1000, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto',
                background: 'var(--bg-card)', borderRadius: 16,
                boxShadow: '0 24px 64px rgba(0,0,0,0.22)', animation: 'slideUp 0.2s ease',
            }}>
                {/* Header */}
                <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            {slot ? 'Edit Slot' : 'Add Slot'} — {day}, Period {form.period}
                        </h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '3px 0 0' }}>Timetable slot editor</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: 'var(--text-tertiary)', lineHeight: 1 }}>×</button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Period Timing */}
                    <div>
                        <p style={{ ...labelStyle, marginBottom: 10, color: 'var(--text-secondary)', fontSize: '0.72rem' }}>⏱ PERIOD TIMING</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                            <div>
                                <label style={labelStyle}>Period #</label>
                                <input type="number" min={1} value={form.period}
                                    onChange={e => upd('period', parseInt(e.target.value) || 1)}
                                    style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Start Time</label>
                                <input type="time" value={form.startTime}
                                    onChange={e => upd('startTime', e.target.value)}
                                    style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>End Time</label>
                                <input type="time" value={form.endTime}
                                    onChange={e => upd('endTime', e.target.value)}
                                    style={inputStyle} />
                            </div>
                        </div>
                    </div>

                    {/* Slot Type */}
                    <div>
                        <label style={labelStyle}>Slot Type</label>
                        <div style={{ display: 'flex', gap: 10 }}>
                            {['class', 'lab', 'free'].map(t => (
                                <label key={t} style={{
                                    display: 'flex', alignItems: 'center', gap: 7,
                                    padding: '8px 16px', borderRadius: 9, cursor: 'pointer',
                                    border: `2px solid ${form.type === t ? 'var(--primary)' : 'var(--border)'}`,
                                    background: form.type === t ? 'rgba(46,125,50,0.07)' : 'var(--bg-secondary)',
                                    fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)',
                                    transition: 'all 0.15s ease',
                                }}>
                                    <input type="radio" name="slotType" value={t}
                                        checked={form.type === t}
                                        onChange={() => upd('type', t)}
                                        style={{ accentColor: 'var(--primary)' }} />
                                    {t === 'class' ? 'Regular Class' : t === 'lab' ? 'Lab' : 'Free Period'}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Subject + Faculty + Room */}
                    {form.type !== 'free' && (
                        <>
                            <div>
                                <label style={labelStyle}>Subject</label>
                                {subjects.length === 0 ? (
                                    <p style={{ fontSize: '0.8rem', color: '#F59E0B', padding: '8px 0' }}>
                                        ⚠ No subjects found. Please add subjects first from the Subjects page.
                                    </p>
                                ) : (
                                    <select value={form.subjectId || ''} onChange={e => handleSubjectChange(e.target.value)} style={inputStyle}>
                                        <option value="">Select subject...</option>
                                        {subjects.map(s => (
                                            <option key={s.id} value={String(s.id)}>{s.name} ({s.code})</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div>
                                <label style={labelStyle}>Faculty</label>
                                {faculty.length === 0 ? (
                                    <p style={{ fontSize: '0.8rem', color: '#F59E0B', padding: '8px 0' }}>
                                        ⚠ No faculty found. Please add faculty first from the Faculty page.
                                    </p>
                                ) : (
                                    <select value={form.facultyId || ''} onChange={e => handleFacultyChange(e.target.value)} style={inputStyle}>
                                        <option value="">Select faculty...</option>
                                        {faculty.map(f => (
                                            <option key={f.id} value={String(f.id)}>{f.full_name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <div>
                                <label style={labelStyle}>Room / Lab</label>
                                <input type="text" value={form.room} placeholder="e.g. Room 201 or CS Lab 1"
                                    onChange={e => upd('room', e.target.value)}
                                    style={inputStyle} />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 22px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {slot && (
                        <button onClick={onClear} style={{
                            padding: '9px 18px', borderRadius: 9, border: '1.5px solid #DC2626',
                            background: 'rgba(220,38,38,0.07)', color: '#DC2626',
                            fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', marginRight: 'auto',
                        }}>Clear Slot</button>
                    )}
                    <button onClick={onClose} style={{
                        padding: '9px 18px', borderRadius: 9, border: '1.5px solid var(--border)',
                        background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                        fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer',
                    }}>Cancel</button>
                    <button onClick={handleSave} style={{
                        padding: '9px 22px', borderRadius: 9, border: 'none',
                        background: 'linear-gradient(135deg, #2E7D32, #4CAF50)',
                        color: 'white', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(46,125,50,0.3)',
                    }}>Save Slot</button>
                </div>
            </div>
        </>
    );
}

// ─── Slot Cell ────────────────────────────────────────────────────────────
function SlotCell({ slot, onClick }) {
    if (!slot) {
        return (
            <div onClick={onClick} style={{
                minWidth: 150, minHeight: 90, borderRadius: 10,
                border: '2px dashed var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s ease',
                color: 'var(--text-tertiary)', fontSize: '0.8rem',
                background: 'var(--bg-secondary)',
            }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#2E7D32'; e.currentTarget.style.background = 'rgba(46,125,50,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
            >
                + Add
            </div>
        );
    }
    return (
        <div onClick={onClick} style={{
            minWidth: 150, borderRadius: 10, padding: '10px 12px',
            border: '1.5px solid var(--border)',
            background: slot.type === 'lab' ? 'rgba(46,125,50,0.05)' : slot.type === 'free' ? 'rgba(100,100,100,0.05)' : 'var(--bg-card)',
            cursor: 'pointer', transition: 'all 0.15s ease', boxShadow: 'var(--shadow-sm)',
        }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                    P{slot.period} · {slot.startTime}–{slot.endTime}
                </span>
                <TypeBadge type={slot.type} />
            </div>
            {slot.type !== 'free' ? (
                <>
                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 2px', lineHeight: 1.2 }}>{slot.subject}</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '2px 0' }}>{slot.facultyName}</p>
                    <p style={{ fontSize: '0.69rem', color: 'var(--text-tertiary)', margin: 0 }}>{slot.room}</p>
                </>
            ) : (
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 6 }}>Free Period</p>
            )}
        </div>
    );
}

// ─── Copy From Section Modal ──────────────────────────────────────────────
function CopyModal({ isOpen, currentKey, timetables, onCopy, onClose }) {
    const [sourceYear, setSourceYear] = useState(1);
    const [sourceSection, setSourceSection] = useState('A');
    if (!isOpen) return null;
    const sourceKey = sectionKey(sourceYear, sourceSection);
    const hasTimetable = !!(timetables[sourceKey] && Object.values(timetables[sourceKey]).some(d => d && d.length > 0));
    const isSame = sourceKey === currentKey;

    const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' };
    const labelStyle = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.45)' }} />
            <div style={{
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                zIndex: 1000, width: 380, background: 'var(--bg-card)', borderRadius: 16,
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: '24px',
            }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Copy From Section</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 20 }}>Clone an existing section's timetable as a starting point.</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                        <label style={labelStyle}>Year</label>
                        <select value={sourceYear} onChange={e => setSourceYear(parseInt(e.target.value))} style={inputStyle}>
                            {YEARS.map(y => <option key={y} value={y}>{['1st', '2nd', '3rd', '4th'][y - 1]} Year</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Section</label>
                        <select value={sourceSection} onChange={e => setSourceSection(e.target.value)} style={inputStyle}>
                            {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                        </select>
                    </div>
                </div>
                {isSame && <p style={{ fontSize: '0.78rem', color: '#F59E0B', marginBottom: 12 }}>⚠ This is the current section.</p>}
                {!hasTimetable && !isSame && <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 12 }}>No timetable found for that section.</p>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={() => onCopy(sourceKey)} disabled={!hasTimetable || isSame}
                        style={{ padding: '8px 22px', borderRadius: 9, border: 'none', background: hasTimetable && !isSame ? 'linear-gradient(135deg, #1565C0, #42A5F5)' : 'var(--border)', color: 'white', fontSize: '0.83rem', fontWeight: 700, cursor: hasTimetable && !isSame ? 'pointer' : 'not-allowed' }}>
                        Copy
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Main HOD Timetable Page ──────────────────────────────────────────────
export default function HodTimetable() {
    const [year, setYear] = useState(1);
    const [section, setSection] = useState('A');
    const [timetables, setTimetables] = useState({});
    const [saved, setSaved] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    // Real data from API
    const [subjects, setSubjects] = useState([]);
    const [faculty, setFaculty] = useState([]);
    const [configuredPeriods, setConfiguredPeriods] = useState([]); // from PeriodsConfig
    const [loadingData, setLoadingData] = useState(true);
    const [loadingTimetable, setLoadingTimetable] = useState(false);
    const [dataError, setDataError] = useState(null);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalDay, setModalDay] = useState(null);
    const [modalPeriodIndex, setModalPeriodIndex] = useState(null);
    const [copyModalOpen, setCopyModalOpen] = useState(false);

    // Load subjects, faculty and configured periods on mount
    useEffect(() => {
        setLoadingData(true);
        setDataError(null);
        Promise.all([
            apiFetch('/api/hod/subjects'),
            apiFetch('/api/hod/faculty'),
            apiFetch('/api/hod/periods').catch(() => ({ periods: [] })),
        ]).then(([subjectsData, facultyData, periodsData]) => {
            setSubjects(subjectsData.subjects || []);
            setFaculty(facultyData.faculty || []);
            // Sort by period_number so index lookup works correctly
            const sorted = [...(periodsData.periods || [])].sort((a, b) => a.period_number - b.period_number);
            setConfiguredPeriods(sorted);
        }).catch(err => {
            setDataError('Failed to load subjects/faculty: ' + err.message);
        }).finally(() => setLoadingData(false));
    }, []);

    // Load saved timetable from DB whenever year or section changes
    useEffect(() => {
        const k = sectionKey(year, section);
        // Only fetch if we haven't already loaded this section into state
        if (timetables[k] !== undefined) return;
        setLoadingTimetable(true);
        fetch(`/api/hod/timetable?year=${year}&section=${section}`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
                if (data.timetable) {
                    setTimetables(prev => ({ ...prev, [k]: data.timetable }));
                } else {
                    // Mark as loaded-but-empty so we don't fetch again
                    setTimetables(prev => ({
                        ...prev,
                        [k]: Object.fromEntries(DAYS.map(d => [d, []]))
                    }));
                }
            })
            .catch(() => { /* non-fatal — user can still build timetable */ })
            .finally(() => setLoadingTimetable(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [year, section]);

    const key = sectionKey(year, section);
    const dayData = timetables[key] || Object.fromEntries(DAYS.map(d => [d, []]));

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const openSlotEditor = (day, periodIndex) => {
        setModalDay(day);
        setModalPeriodIndex(periodIndex);
        setModalOpen(true);
    };

    const handleSaveSlot = (updatedSlot) => {
        setTimetables(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            if (!next[key]) next[key] = Object.fromEntries(DAYS.map(d => [d, []]));
            const daySlots = [...(next[key][modalDay] || [])];
            daySlots[modalPeriodIndex] = { ...updatedSlot, period: modalPeriodIndex + 1 };
            next[key][modalDay] = daySlots;
            return next;
        });
        setSaved(false);
        setModalOpen(false);
    };

    const handleClearSlot = () => {
        setTimetables(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            if (!next[key]) return prev;
            const daySlots = [...(next[key][modalDay] || [])];
            daySlots[modalPeriodIndex] = null;
            next[key][modalDay] = daySlots;
            return next;
        });
        setSaved(false);
        setModalOpen(false);
    };

    const handleAddPeriod = (day) => {
        setTimetables(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            if (!next[key]) next[key] = Object.fromEntries(DAYS.map(d => [d, []]));
            next[key][day] = [...(next[key][day] || []), null];
            return next;
        });
        setSaved(false);
        const newIndex = (dayData[day] || []).length;
        setTimeout(() => openSlotEditor(day, newIndex), 50);
    };

    // Derive the time for a given period index from the configured periods (or fall back to STD_TIMES)
    const getPeriodTime = (periodIndex) => {
        if (configuredPeriods.length > 0) {
            // Match by sorted order (periodIndex 0 → period_number 1, etc.)
            const cfg = configuredPeriods[periodIndex];
            if (cfg) {
                return {
                    startTime: (cfg.start_time || '').slice(0, 5),
                    endTime: (cfg.end_time || '').slice(0, 5),
                };
            }
        }
        // Fallback to hard-coded STD_TIMES
        return STD_TIMES[Math.min(periodIndex, STD_TIMES.length - 1)];
    };

    const handleSaveTimetable = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const res = await fetch('/api/hod/timetable', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year, section, slots: dayData }),
            });
            if (!res.ok) throw new Error('Save failed');
            setSaved(true);
            showToast(`✅ Timetable saved for ${DEPT} Year ${year} Section ${section}`);
        } catch {
            showToast('❌ Failed to save timetable. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm(`Clear the entire timetable for Year ${year} Section ${section}? This cannot be undone.`)) return;
        const clearedSlots = Object.fromEntries(DAYS.map(d => [d, []]));
        setTimetables(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            next[key] = clearedSlots;
            return next;
        });
        setSaved(false);
        showToast('🗑 Timetable cleared', 'info');
        // Immediately persist the cleared state so it doesn't reappear on navigation
        try {
            await fetch('/api/hod/timetable', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year, section, slots: clearedSlots }),
            });
            setSaved(true);
        } catch {
            // Non-fatal — user can hit Save manually
        }
    };


    const handleCopyFrom = (sourceKey) => {
        if (!timetables[sourceKey]) return;
        setTimetables(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            next[key] = JSON.parse(JSON.stringify(timetables[sourceKey]));
            return next;
        });
        setSaved(false);
        setCopyModalOpen(false);
        showToast('📋 Timetable copied — you can now edit it');
    };

    const currentSlotForModal = modalDay && modalPeriodIndex !== null
        ? (dayData[modalDay] || [])[modalPeriodIndex]
        : null;

    const yearLabels = ['1st', '2nd', '3rd', '4th'];

    return (
        <DashboardLayout>
            <style>{`
                @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes slideUp { from { transform: translate(-50%,-48%); opacity: 0 } to { transform: translate(-50%,-50%); opacity: 1 } }
                @keyframes toastIn { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
                .tt-scroll { overflow-x: auto; scrollbar-width: thin; }
                .tt-scroll::-webkit-scrollbar { height: 5px; }
                .tt-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
            `}</style>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
                    background: toast.type === 'success' ? '#2E7D32' : toast.type === 'error' ? '#DC2626' : '#1565C0',
                    color: 'white', borderRadius: 12, padding: '13px 20px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                    fontSize: '0.875rem', fontWeight: 600, animation: 'toastIn 0.3s ease',
                }}>{toast.msg}</div>
            )}

            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                        Timetable Builder 📅
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        Build and manage timetables for each section
                    </p>
                </div>

                {/* Section Selector */}
                <div style={{
                    display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap',
                    background: 'var(--bg-card)', padding: '14px 18px', borderRadius: 12,
                    border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
                }}>
                    <div>
                        <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 5 }}>Year</p>
                        <select value={year} onChange={e => { setYear(parseInt(e.target.value)); setSaved(true); }}
                            style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                            {YEARS.map(y => <option key={y} value={y}>{yearLabels[y - 1]} Year</option>)}
                        </select>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 5 }}>Section</p>
                        <select value={section} onChange={e => { setSection(e.target.value); setSaved(true); }}
                            style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                            {SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                        </select>
                    </div>
                    <div style={{
                        padding: '5px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
                        background: saved ? 'rgba(46,125,50,0.1)' : 'rgba(220,38,38,0.08)',
                        color: saved ? '#2E7D32' : '#DC2626',
                        border: `1.5px solid ${saved ? 'rgba(46,125,50,0.25)' : 'rgba(220,38,38,0.2)'}`,
                        alignSelf: 'flex-end', marginBottom: 1,
                    }}>
                        {saved ? '✓ Saved' : '● Unsaved'}
                    </div>
                </div>
            </div>

            {/* Loading / Error state */}
            {loadingData ? (
                <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading subjects and faculty...</p>
                </div>
            ) : dataError ? (
                <div style={{ padding: '24px', borderRadius: 12, background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.3)', marginBottom: 20 }}>
                    <p style={{ fontSize: '0.85rem', color: '#DC2626', fontWeight: 600, margin: 0 }}>⚠ {dataError}</p>
                </div>
            ) : (
                <>
                    {/* Info banners if no subjects/faculty */}
                    {subjects.length === 0 && (
                        <div style={{ padding: '12px 18px', borderRadius: 10, marginBottom: 16, background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.35)', display: 'flex', gap: 10 }}>
                            <span>⚠</span>
                            <p style={{ margin: 0, fontSize: '0.84rem', color: '#B45309', fontWeight: 600 }}>
                                No subjects added yet. Go to <strong>Subjects</strong> page to add subjects before building the timetable.
                            </p>
                        </div>
                    )}
                    {faculty.length === 0 && (
                        <div style={{ padding: '12px 18px', borderRadius: 10, marginBottom: 16, background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.35)', display: 'flex', gap: 10 }}>
                            <span>⚠</span>
                            <p style={{ margin: 0, fontSize: '0.84rem', color: '#B45309', fontWeight: 600 }}>
                                No faculty added yet. Go to <strong>Faculty</strong> page to add faculty before building the timetable.
                            </p>
                        </div>
                    )}

                    {/* Timetable Grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {DAYS.map(day => {
                            const slots = dayData[day] || [];
                            return (
                                <div key={day} style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                                    <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', minWidth: 90 }}>{day}</span>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                            {slots.filter(Boolean).length} / {slots.length} periods filled
                                        </span>
                                    </div>
                                    <div className="tt-scroll" style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                        {slots.length === 0 ? (
                                            <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', padding: '12px 4px' }}>
                                                No periods yet. Click "+ Add Period" to start building.
                                            </p>
                                        ) : (
                                            slots.map((slot, idx) => (
                                                <SlotCell
                                                    key={idx}
                                                    slot={slot}
                                                    onClick={() => openSlotEditor(day, idx)}
                                                />
                                            ))
                                        )}
                                        <button onClick={() => handleAddPeriod(day)} style={{
                                            minWidth: 90, minHeight: 90, borderRadius: 10,
                                            border: '2px dashed #2E7D32',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                                            cursor: 'pointer', background: 'rgba(46,125,50,0.04)',
                                            color: '#2E7D32', fontSize: '0.75rem', fontWeight: 700,
                                            transition: 'all 0.15s ease', flexShrink: 0,
                                        }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(46,125,50,0.1)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(46,125,50,0.04)'; }}
                                        >
                                            <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>+</span>
                                            Add Period
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Bottom Actions */}
                    <div style={{
                        marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap',
                        padding: '16px 20px', background: 'var(--bg-card)',
                        border: '1px solid var(--border)', borderRadius: 14,
                        boxShadow: 'var(--shadow-sm)', alignItems: 'center',
                    }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                                {DEPT} · Year {year} · Section {section}
                            </p>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 3 }}>
                                {Object.values(dayData).flat().filter(Boolean).length} total periods configured
                            </p>
                        </div>
                        <button onClick={() => setCopyModalOpen(true)} style={{
                            padding: '10px 20px', borderRadius: 10, border: '1.5px solid var(--border)',
                            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                            fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                        }}>📋 Copy From Section</button>
                        <button onClick={handleClearAll} style={{
                            padding: '10px 20px', borderRadius: 10, border: '1.5px solid rgba(220,38,38,0.4)',
                            background: 'rgba(220,38,38,0.06)', color: '#DC2626',
                            fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                        }}>🗑 Clear All</button>
                        <button onClick={handleSaveTimetable} disabled={saving || (saved && !loadingTimetable)} style={{
                            padding: '10px 28px', borderRadius: 10, border: 'none',
                            background: saving ? '#888' : saved ? 'var(--border)' : 'linear-gradient(135deg, #2E7D32, #4CAF50)',
                            color: (saving || saved) ? 'var(--text-secondary)' : 'white',
                            fontSize: '0.84rem', fontWeight: 700, cursor: (saving || saved) ? 'default' : 'pointer',
                            boxShadow: saved ? 'none' : '0 2px 10px rgba(46,125,50,0.3)', transition: 'all 0.2s ease',
                        }}>
                            {saving ? '⏳ Saving…' : saved ? '✓ Saved' : '💾 Save Timetable'}
                        </button>
                    </div>
                </>
            )}

            {/* Slot Editor Modal */}
            <SlotEditorModal
                isOpen={modalOpen}
                slot={currentSlotForModal}
                day={modalDay}
                periodIndex={modalPeriodIndex}
                subjects={subjects}
                faculty={faculty}
                getPeriodTime={getPeriodTime}
                onSave={handleSaveSlot}
                onClear={handleClearSlot}
                onClose={() => setModalOpen(false)}
            />

            {/* Copy Modal */}
            <CopyModal
                isOpen={copyModalOpen}
                currentKey={key}
                timetables={timetables}
                onCopy={handleCopyFrom}
                onClose={() => setCopyModalOpen(false)}
            />
        </DashboardLayout>
    );
}
