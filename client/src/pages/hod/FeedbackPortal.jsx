import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import api from '../../utils/api';
import {
    FEEDBACK_CYCLES, MOCK_FEEDBACK_STUDENTS,
    calcFacultyScore, getFacultyResponseCount, getBestAndWeakestFields
} from '../../data/feedbackData';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function genId() { return 'f' + Math.random().toString(36).slice(2, 7); }

function StatusBadge({ status }) {
    const map = {
        active: { bg: 'rgba(22,163,74,0.12)', color: '#15803D', label: 'ACTIVE' },
        draft:  { bg: 'rgba(234,179,8,0.12)',  color: '#B45309', label: 'DRAFT' },
        closed: { bg: 'rgba(220,38,38,0.1)',   color: '#DC2626', label: 'CLOSED' },
    };
    const s = map[status] || map.draft;
    return (
        <span style={{
            padding: '3px 12px', borderRadius: 100, fontSize: '0.68rem',
            fontWeight: 700, background: s.bg, color: s.color, letterSpacing: '0.08em',
        }}>{s.label}</span>
    );
}

function Toast({ message, type = 'success', onClose }) {
    useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
    return (
        <div style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            background: type === 'success' ? '#15803D' : type === 'error' ? '#DC2626' : '#1A3C6E',
            color: 'white', padding: '14px 22px', borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)', fontSize: '0.875rem', fontWeight: 600,
            animation: 'fadeIn 0.3s ease', maxWidth: 380,
        }}>
            {message}
        </div>
    );
}

function ConfirmModal({ title, message, onConfirm, onCancel, confirmLabel = 'Confirm', confirmClass = 'btn-hod' }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 5000, background: 'var(--overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
            <div style={{
                background: 'var(--bg-card)', borderRadius: 16, maxWidth: 420, width: '100%',
                padding: '28px 28px 24px', boxShadow: 'var(--shadow-xl)', animation: 'scaleIn 0.2s ease',
            }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{message}</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
                    <button className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
                    <button className={`btn btn-sm ${confirmClass}`} onClick={onConfirm}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}

// ─── TAB 1: Create Feedback Form ─────────────────────────────────────────────
function CreateTab({ cycle, setCycle, onPublish, onDraft, onClose, actualFaculty, actualStudents }) {
    const [fields, setFields] = useState(cycle?.fields || []);
    const [title, setTitle] = useState(cycle?.title || '');
    const [startDate, setStartDate] = useState(cycle?.startDate || '');
    const [endDate, setEndDate] = useState(cycle?.endDate || '');
    const [targetYear, setTargetYear] = useState(cycle?.targetYear ? String(cycle.targetYear) : '');
    const [targetSections, setTargetSections] = useState(new Set(cycle?.targetSections || []));
    const [includedFaculty, setIncludedFaculty] = useState(
        new Set(cycle?.includedFaculty || [])
    );
    const [errors, setErrors] = useState([]);

    const ALL_OPTIONS = ['Excellent', 'Good', 'Average', 'Bad'];

    // Derive available sections from students of the selected year
    const availableSections = [...new Set(
        (actualStudents || [])
            .filter(s => targetYear && s.year === parseInt(targetYear))
            .map(s => s.section)
    )].sort();
    const sectionOptions = availableSections.length > 0 ? availableSections : ['A', 'B', 'C', 'D'];

    const toggleSection = (sec) => setTargetSections(prev => {
        const n = new Set(prev);
        n.has(sec) ? n.delete(sec) : n.add(sec);
        return n;
    });

    const addField = () => setFields(f => [...f, { id: genId(), label: '', options: ['Excellent', 'Good', 'Average', 'Bad'] }]);

    const removeField = (id) => setFields(f => f.filter(x => x.id !== id));

    const updateField = (id, key, val) => setFields(f => f.map(x => x.id === id ? { ...x, [key]: val } : x));

    const toggleOption = (id, opt) => setFields(f => f.map(x => {
        if (x.id !== id) return x;
        const opts = x.options.includes(opt) ? x.options.filter(o => o !== opt) : [...x.options, opt];
        return { ...x, options: opts };
    }));

    const moveField = (idx, dir) => {
        const arr = [...fields];
        const target = idx + dir;
        if (target < 0 || target >= arr.length) return;
        [arr[idx], arr[target]] = [arr[target], arr[idx]];
        setFields(arr);
    };

    const toggleFaculty = (id) => setIncludedFaculty(prev => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });

    const validate = () => {
        const errs = [];
        if (!title.trim()) errs.push('Feedback title is required.');
        if (!startDate) errs.push('Start date is required.');
        if (!endDate) errs.push('End date is required.');
        if (startDate && endDate && endDate < startDate) errs.push('End date must be after start date.');
        if (!targetYear) errs.push('Target year is required.');
        if (targetSections.size === 0) errs.push('At least one target section must be selected.');
        if (includedFaculty.size === 0) errs.push('At least one faculty must be included.');
        if (fields.length === 0) errs.push('At least one field is required.');
        fields.forEach((f, i) => {
            if (!f.label.trim()) errs.push(`Field ${i + 1}: Label is required.`);
            if (f.options.length < 2) errs.push(`Field ${i + 1} ("${f.label || 'Untitled'}"): At least 2 options required.`);
        });
        setErrors(errs);
        return errs.length === 0;
    };

    const handlePublish = () => {
        if (validate()) {
            const facultyDetails = actualFaculty.filter(f => includedFaculty.has(f.id));
            onPublish({ title, startDate, endDate, targetYear: parseInt(targetYear), targetSections: [...targetSections].sort(), includedFaculty: [...includedFaculty], fields, facultyDetails });
        }
    };
    const handleDraft = () => {
        const facultyDetails = actualFaculty.filter(f => includedFaculty.has(f.id));
        onDraft({ title, startDate, endDate, targetYear: parseInt(targetYear), targetSections: [...targetSections].sort(), includedFaculty: [...includedFaculty], fields, facultyDetails });
    };

    const isActive = cycle?.status === 'active';
    const isClosed = cycle?.status === 'closed';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Cycle Settings */}
            <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Cycle Settings</h3>
                    {cycle && <StatusBadge status={cycle.status} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                        <label className="form-label">Feedback Title <span className="required">*</span></label>
                        <input className="form-input" placeholder='e.g. "Semester 4 — Faculty Feedback 2024-25"'
                            value={title} onChange={e => setTitle(e.target.value)} disabled={isClosed} />
                    </div>
                    <div className="form-row form-row-2">
                        <div className="form-group">
                            <label className="form-label">Start Date <span className="required">*</span></label>
                            <input type="date" className="form-input" value={startDate}
                                onChange={e => setStartDate(e.target.value)} disabled={isClosed} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">End Date <span className="required">*</span></label>
                            <input type="date" className="form-input" value={endDate}
                                onChange={e => setEndDate(e.target.value)} disabled={isClosed} />
                        </div>
                    </div>
                    {/* Year & Section Targeting */}
                    <div className="form-row form-row-2">
                        <div className="form-group">
                            <label className="form-label">Target Year <span className="required">*</span></label>
                            <select className="form-input" value={targetYear}
                                onChange={e => { setTargetYear(e.target.value); setTargetSections(new Set()); }}
                                disabled={isClosed}>
                                <option value="">— Select Year —</option>
                                <option value="1">Year 1</option>
                                <option value="2">Year 2</option>
                                <option value="3">Year 3</option>
                                <option value="4">Year 4</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Target Sections <span className="required">*</span></label>
                            {targetYear ? (
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                                    {sectionOptions.map(sec => {
                                        const sel = targetSections.has(sec);
                                        return (
                                            <button key={sec} type="button"
                                                onClick={() => !isClosed && toggleSection(sec)}
                                                disabled={isClosed}
                                                style={{
                                                    padding: '7px 18px', borderRadius: 8,
                                                    fontSize: '0.85rem', fontWeight: 700,
                                                    cursor: isClosed ? 'not-allowed' : 'pointer',
                                                    background: sel ? '#1A3C6E' : 'var(--bg-card)',
                                                    color: sel ? 'white' : 'var(--text-secondary)',
                                                    border: sel ? '1.5px solid #1A3C6E' : '1px solid var(--border)',
                                                    transition: 'all 0.18s',
                                                }}
                                            >Section {sec}</button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', paddingTop: 10 }}>
                                    Select a year first
                                </p>
                            )}
                        </div>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        📌 Target:{' '}
                        {targetYear && targetSections.size > 0
                            ? <><strong>Year {targetYear} · Section {[...targetSections].sort().join(', ')}</strong> — Only these students will see this form.</>  
                            : <strong>Select year and section above to define who receives this form.</strong>
                        }
                        {' '}After the end date, the form closes automatically.
                    </p>
                </div>
            </div>

            {/* Faculty List */}
            <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Faculty List</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {actualFaculty.length === 0 && <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Loading faculty or no active faculty found...</p>}
                    {actualFaculty.map(fac => {
                        const included = includedFaculty.has(fac.id);
                        return (
                            <div key={fac.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', borderRadius: 10,
                                background: included ? 'rgba(46,125,50,0.06)' : 'var(--bg-secondary)',
                                border: `1px solid ${included ? 'rgba(46,125,50,0.2)' : 'var(--border)'}`,
                                transition: 'all 0.2s',
                            }}>
                                <div>
                                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>👨‍🏫 {fac.name}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                        {fac.designation} · {fac.subjects.join(', ')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => !isClosed && toggleFaculty(fac.id)}
                                    disabled={isClosed}
                                    style={{
                                        padding: '6px 14px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700,
                                        cursor: isClosed ? 'not-allowed' : 'pointer',
                                        background: included ? '#15803D' : 'var(--bg-card)',
                                        color: included ? 'white' : 'var(--text-secondary)',
                                        border: included ? 'none' : '1px solid var(--border)',
                                        transition: 'all 0.2s',
                                    }}
                                >{included ? '✓ Included' : 'Excluded'}</button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Field Builder */}
            <div className="card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Form Fields</h3>
                    {!isClosed && (
                        <button className="btn btn-hod btn-sm" onClick={addField}>+ Add Field</button>
                    )}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    These fields appear for every included faculty member. Students rate each faculty on all fields.
                </p>
                {fields.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                        No fields yet. Click "+ Add Field" to begin.
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {fields.map((field, idx) => (
                        <div key={field.id} style={{
                            padding: '16px', borderRadius: 10,
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                                {/* Reorder */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <button onClick={() => moveField(idx, -1)} disabled={idx === 0 || isClosed}
                                        style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'not-allowed' : 'pointer', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1, padding: '2px 4px' }}>▲</button>
                                    <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1 || isClosed}
                                        style={{ background: 'none', border: 'none', cursor: idx === fields.length - 1 ? 'not-allowed' : 'pointer', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1, padding: '2px 4px' }}>▼</button>
                                </div>
                                <input className="form-input" style={{ flex: 1 }}
                                    placeholder={`Field label, e.g. "Teaching Quality"`}
                                    value={field.label}
                                    onChange={e => updateField(field.id, 'label', e.target.value)}
                                    disabled={isClosed} />
                                {!isClosed && (
                                    <button onClick={() => removeField(field.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16, padding: '4px 6px' }}>✕</button>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingLeft: 36 }}>
                                {ALL_OPTIONS.map(opt => (
                                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isClosed ? 'default' : 'pointer', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                        <input type="checkbox"
                                            checked={field.options.includes(opt)}
                                            onChange={() => !isClosed && toggleOption(field.id, opt)}
                                            disabled={isClosed}
                                            style={{ cursor: isClosed ? 'default' : 'pointer' }} />
                                        {opt}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Validation errors */}
            {errors.length > 0 && (
                <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)' }}>
                    {errors.map((e, i) => (
                        <p key={i} style={{ fontSize: '0.82rem', color: '#B91C1C', marginTop: i > 0 ? 4 : 0 }}>• {e}</p>
                    ))}
                </div>
            )}

            {/* Actions */}
            {!isClosed && (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {isActive && (
                        <button className="btn btn-danger" onClick={onClose}>⛔ Close Form Early</button>
                    )}
                    <button className="btn btn-outline" onClick={handleDraft}>💾 Save as Draft</button>
                    <button className="btn btn-hod" onClick={handlePublish}>
                        {isActive ? '✓ Update Form' : '🚀 Publish Feedback Form'}
                    </button>
                </div>
            )}
            {isClosed && (
                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.875rem', color: '#B91C1C', fontWeight: 600 }}>🔒 This feedback cycle is closed. No further edits allowed.</p>
                </div>
            )}
        </div>
    );
}

// ─── TAB 2: Analysis & Results ────────────────────────────────────────────────
function ScoreBar({ label, count, total, color = '#1A3C6E' }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ width: 72, fontSize: '0.72rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
            </div>
            <span style={{ width: 36, fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'right' }}>{pct}%</span>
        </div>
    );
}

function getOptionColor(opt) {
    return { Excellent: '#15803D', Good: '#1565C0', Average: '#B45309', Bad: '#DC2626' }[opt] || '#64748B';
}

function AnalysisTab({ cycle, actualStudents }) {
    const [toast, setToast] = useState(null);
    const [sectionFilter, setSectionFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [expandedDept, setExpandedDept] = useState(null);

    const showToast = (msg, type = 'success') => setToast({ msg, type });

    const students = actualStudents || [];
    const submitted = new Set(cycle.submittedBy);

    const filteredStudents = students.filter(s => {
        if (yearFilter && s.year !== parseInt(yearFilter)) return false;
        if (sectionFilter && s.section !== sectionFilter) return false;
        if (statusFilter === 'submitted' && !submitted.has(s.rollNumber)) return false;
        if (statusFilter === 'pending' && submitted.has(s.rollNumber)) return false;
        return true;
    });

    const submittedCount = students.filter(s => submitted.has(s.rollNumber)).length;
    const pendingCount = students.length - submittedCount;
    const responseRate = students.length > 0 ? Math.round((submittedCount / students.length) * 100) : 0;

    // Faculty analysis
    const facultyInCycle = cycle.facultyDetails || [];

    const getFacultyData = (fac) => {
        const rat = cycle.ratings[fac.id] || {};
        const score = calcFacultyScore(rat, cycle.fields);
        const responses = getFacultyResponseCount(rat, cycle.fields);
        const { best, weakest } = getBestAndWeakestFields(rat, cycle.fields);
        return { score, responses, best, weakest };
    };

    const ranked = [...facultyInCycle]
        .map(f => ({ ...f, ...getFacultyData(f) }))
        .sort((a, b) => b.score - a.score);

    const deptAvg = ranked.length > 0 ? (ranked.reduce((s, f) => s + f.score, 0) / ranked.length).toFixed(1) : '0.0';

    const getBadge = (score) => {
        if (score >= 3.5) return { label: '⭐ Excellent', bg: 'rgba(22,163,74,0.12)', color: '#15803D' };
        if (score >= 2.5) return { label: '✓ Good',      bg: 'rgba(21,101,192,0.12)', color: '#1565C0' };
        if (score >= 1.5) return { label: '~ Average',   bg: 'rgba(234,179,8,0.12)',  color: '#B45309' };
        return               { label: '⚠ Needs Improvement', bg: 'rgba(220,38,38,0.1)', color: '#DC2626' };
    };

    const sections = [...new Set(students.map(s => s.section))].sort();
    const years = [...new Set(students.map(s => s.year))].sort();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

            {/* Export buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-outline btn-sm" onClick={() => showToast('📊 Feedback report exported as Excel')}>📊 Export Excel</button>
                <button className="btn btn-hod btn-sm" onClick={() => showToast('📄 Feedback report exported as PDF')}>📄 Export PDF</button>
            </div>

            {/* SECTION A: Submission Tracker */}
            <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                    Section A — Submission Tracker
                </h3>

                {/* Summary bar */}
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 18, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                    {[
                        { label: 'Submitted', value: submittedCount, color: '#15803D' },
                        { label: 'Pending',   value: pendingCount,   color: '#DC2626' },
                        { label: 'Response Rate', value: `${responseRate}%`, color: '#1A3C6E' },
                    ].map(stat => (
                        <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.color }}>{stat.value}</span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{stat.label}</span>
                            <span style={{ color: 'var(--border)' }}>|</span>
                        </div>
                    ))}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
                        ℹ️ HOD can see who submitted, but individual ratings are anonymous
                    </span>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                    <select className="form-input" style={{ width: 'auto', minWidth: 100 }}
                        value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                        <option value="">All Years</option>
                        {years.map(y => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                    <select className="form-input" style={{ width: 'auto', minWidth: 110 }}
                        value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}>
                        <option value="">All Sections</option>
                        {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
                    </select>
                    <select className="form-input" style={{ width: 'auto', minWidth: 120 }}
                        value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="">All Status</option>
                        <option value="submitted">Submitted</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>

                {/* Student table */}
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                {['Roll No', 'Name', 'Year', 'Section', 'Status'].map(h => (
                                    <th key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.map(s => {
                                const sub = submitted.has(s.rollNumber);
                                return (
                                    <tr key={s.rollNumber}>
                                        <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{s.rollNumber}</td>
                                        <td>{s.name}</td>
                                        <td>Year {s.year}</td>
                                        <td>Section {s.section}</td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600,
                                                background: sub ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)',
                                                color: sub ? '#15803D' : '#DC2626',
                                            }}>
                                                {sub ? '✅ Submitted' : '🔴 Pending'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECTION B: Faculty Ratings */}
            <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
                    Section B — Faculty Ratings Analysis
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {facultyInCycle.map(fac => {
                        const rat = cycle.ratings[fac.id] || {};
                        const { score, responses } = getFacultyData(fac);
                        return (
                            <div key={fac.id} style={{
                                border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
                            }}>
                                <div style={{
                                    padding: '14px 20px', background: 'var(--bg-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    flexWrap: 'wrap', gap: 12,
                                }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>👨‍🏫 {fac.name}</p>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                            {fac.subjects.join(' · ')}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '1.6rem', fontWeight: 900, color: '#1A3C6E', lineHeight: 1 }}>{score.toFixed(1)}</p>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>/ 4.0 · {responses} responses</p>
                                    </div>
                                </div>
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {cycle.fields.map(field => {
                                        const r = rat[field.id] || {};
                                        const total = Object.values(r).reduce((s, c) => s + c, 0);
                                        const weights = { Excellent: 4, Good: 3, Average: 2, Bad: 1 };
                                        const wSum = Object.entries(r).reduce((s, [o, c]) => s + (weights[o] || 0) * c, 0);
                                        const fieldScore = total > 0 ? (wSum / total).toFixed(1) : '—';
                                        return (
                                            <div key={field.id}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{field.label}</p>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Avg: <strong style={{ color: '#1A3C6E' }}>{fieldScore}</strong></span>
                                                </div>
                                                {field.options.map(opt => (
                                                    <ScoreBar key={opt} label={opt} count={r[opt] || 0} total={total} color={getOptionColor(opt)} />
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SECTION C: Faculty Ranking */}
            <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                    Section C — Faculty Ranking
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                {['Rank', 'Faculty', 'Avg Score', 'Top Field', 'Weakest Field', 'Responses', 'Badge'].map(h => (
                                    <th key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ranked.map((fac, i) => {
                                const badge = getBadge(fac.score);
                                return (
                                    <tr key={fac.id}>
                                        <td style={{ fontWeight: 800, fontSize: '1rem', color: i === 0 ? '#B45309' : 'var(--text-primary)' }}>
                                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                        </td>
                                        <td>
                                            <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{fac.name}</p>
                                            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{fac.subjects.join(', ')}</p>
                                        </td>
                                        <td style={{ fontWeight: 700, color: '#1A3C6E', fontSize: '1rem' }}>{fac.score.toFixed(1)}</td>
                                        <td style={{ fontSize: '0.8rem', color: '#15803D' }}>{fac.best}</td>
                                        <td style={{ fontSize: '0.8rem', color: '#DC2626' }}>{fac.weakest}</td>
                                        <td>{fac.responses}</td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem',
                                                fontWeight: 600, background: badge.bg, color: badge.color,
                                            }}>{badge.label}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECTION D: Department Summary */}
            <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                    Section D — Department Summary
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                    {[
                        {
                            title: 'Total Responses',
                            value: submittedCount,
                            sub: `out of ${students.length} students`,
                            color: '#1A3C6E', bg: 'rgba(26,60,110,0.06)',
                        },
                        {
                            title: 'Response Rate',
                            value: `${responseRate}%`,
                            sub: pendingCount > 0 ? `${pendingCount} students pending` : 'All students responded',
                            color: responseRate >= 75 ? '#15803D' : responseRate >= 50 ? '#B45309' : '#DC2626',
                            bg: responseRate >= 75 ? 'rgba(22,163,74,0.06)' : responseRate >= 50 ? 'rgba(234,179,8,0.06)' : 'rgba(220,38,38,0.06)',
                        },
                        {
                            title: 'Dept Avg Score',
                            value: deptAvg,
                            sub: '/ 4.0',
                            color: '#6A1B9A', bg: 'rgba(106,27,154,0.06)',
                        },
                        {
                            title: 'Best Faculty',
                            value: ranked[0]?.name || '—',
                            sub: ranked[0] ? `Score: ${ranked[0].score.toFixed(1)}` : '',
                            color: '#15803D', bg: 'rgba(22,163,74,0.06)',
                        },
                    ].map(stat => (
                        <div key={stat.title} style={{
                            padding: '18px 18px', borderRadius: 12,
                            background: stat.bg, border: '1px solid transparent',
                        }}>
                            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 8 }}>{stat.title}</p>
                            <p style={{ fontSize: '1.4rem', fontWeight: 900, color: stat.color, lineHeight: 1.1 }}>{stat.value}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>{stat.sub}</p>
                        </div>
                    ))}
                </div>
                {ranked.filter(f => f.score < 2.5).length > 0 && (
                    <div style={{ marginTop: 14, padding: '12px 16px', borderRadius: 10, background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)' }}>
                        <p style={{ fontSize: '0.82rem', color: '#B91C1C', fontWeight: 600 }}>
                            ⚠ Faculty needing attention: {ranked.filter(f => f.score < 2.5).map(f => f.name).join(', ')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── localStorage key ─────────────────────────────────────────────────────────
const LS_KEY = 'vignan_hod_feedback_cycle_cse';

function loadCycles() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch { return []; }
}

function saveCycles(cycles) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(cycles));
    } catch {}
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HodFeedbackPortal() {
    const [activeTab, setActiveTab] = useState('manage'); // manage, create, analysis
    const [cycles, setCyclesState] = useState(() => loadCycles());
    const [selectedCycleId, setSelectedCycleId] = useState(null);
    const [toast, setToast] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [actualFaculty, setActualFaculty] = useState([]);
    const [actualStudents, setActualStudents] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [facRes, asgRes, stuRes] = await Promise.all([
                    api.get('/hod/faculty'),
                    api.get('/hod/assignments'),
                    api.get('/hod/students')
                ]);
                
                const subjectsByFacId = {};
                if (asgRes.data.assignments) {
                    asgRes.data.assignments.forEach(a => {
                        if (!subjectsByFacId[a.faculty_id]) subjectsByFacId[a.faculty_id] = new Set();
                        subjectsByFacId[a.faculty_id].add(a.subject_name);
                    });
                }
                
                if (facRes.data.faculty) {
                    const list = facRes.data.faculty
                        .filter(f => f.is_active)
                        .map(f => ({
                            id: String(f.id),
                            name: f.full_name,
                            designation: f.designation || 'Faculty',
                            subjects: subjectsByFacId[f.id] ? Array.from(subjectsByFacId[f.id]) : ['Not Assigned']
                        }));
                    setActualFaculty(list);
                }

                if (stuRes.data.students) {
                    const stuList = stuRes.data.students
                        .filter(s => s.is_active)
                        .map(s => ({
                            id: String(s.id),
                            rollNumber: s.roll_number || s.login_id,
                            name: s.full_name,
                            year: s.year,
                            section: s.section
                        }));
                    setActualStudents(stuList);
                }
            } catch (err) {
                console.error('Failed to fetch feedback portal data', err);
            }
        };
        fetchData();
    }, []);

    // Always persist to localStorage whenever cycles array changes
    const setCycles = (updater) => {
        setCyclesState(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            saveCycles(next);
            return next;
        });
    };

    const cycle = cycles.find(c => c.id === selectedCycleId) || null;

    const showToast = (msg, type = 'success') => setToast({ msg, type });

    const saveCurrentCycle = (data, status) => {
        const id = cycle?.id || 'FB_' + Date.now();
        const updatedCycle = {
            id,
            dept: 'CSE',
            ratings: cycle?.ratings || {},
            submittedBy: cycle?.submittedBy || [],
            totalStudents: actualStudents.length,
            ...data,
            status,
        };

        setCycles(prev => {
            const idx = prev.findIndex(c => c.id === id);
            if (idx >= 0) {
                const arr = [...prev];
                arr[idx] = updatedCycle;
                return arr;
            }
            return [...prev, updatedCycle];
        });
        
        setSelectedCycleId(id);
        return updatedCycle;
    };

    const handlePublish = (data) => {
        setConfirm({
            title: 'Publish Feedback Form?',
            message: `This will activate the form from ${data.startDate} to ${data.endDate}. ${data.includedFaculty.length} faculty included, ${data.fields.length} fields created. Students can now submit feedback.`,
            onConfirm: () => {
                saveCurrentCycle(data, 'active');
                setConfirm(null);
                showToast(`✅ Feedback form published!`);
            },
        });
    };

    const handleDraft = (data) => {
        saveCurrentCycle(data, 'draft');
        showToast('💾 Saved as draft.');
    };

    const handleClose = () => {
        setConfirm({
            title: 'Close Feedback Form Early?',
            message: 'This will immediately close the feedback form. Students will no longer be able to submit.',
            confirmLabel: 'Close Form',
            confirmClass: 'btn-danger',
            onConfirm: () => {
                const currentData = {
                    title: cycle.title,
                    startDate: cycle.startDate,
                    endDate: cycle.endDate,
                    includedFaculty: cycle.includedFaculty,
                    fields: cycle.fields,
                    facultyDetails: cycle.facultyDetails
                };
                saveCurrentCycle(currentData, 'closed');
                setConfirm(null);
                showToast('🔒 Feedback form closed.', 'error');
            },
        });
    };

    const handleNewCycle = () => {
        setSelectedCycleId(null);
        setActiveTab('create');
        showToast('🆕 Ready to create a new feedback cycle.');
    };

    const handleDelete = (id, title) => {
        setConfirm({
            title: 'Delete Feedback Form?',
            message: `Are you sure you want to permanently delete "${title || 'Untitled Form'}"? This action cannot be undone and all associated responses will be lost.`,
            confirmLabel: 'Delete Form',
            confirmClass: 'btn-danger',
            onConfirm: () => {
                setCycles(prev => prev.filter(c => c.id !== id));
                if (selectedCycleId === id) {
                    setSelectedCycleId(null);
                    setActiveTab('manage');
                }
                setConfirm(null);
                showToast('🗑️ Feedback form deleted.', 'error');
            },
        });
    };

    const tabs = selectedCycleId ? [
        { id: 'create',   label: '📝 Form Configuration' },
        { id: 'analysis', label: '📊 Analysis & Results' },
    ] : [];

    return (
        <DashboardLayout>
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
            {confirm && (
                <ConfirmModal
                    title={confirm.title}
                    message={confirm.message}
                    confirmLabel={confirm.confirmLabel}
                    confirmClass={confirm.confirmClass}
                    onConfirm={confirm.onConfirm}
                    onCancel={() => setConfirm(null)}
                />
            )}

            {/* Page Header */}
            <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {activeTab !== 'manage' && (
                            <button className="btn btn-outline btn-sm" onClick={() => { setSelectedCycleId(null); setActiveTab('manage'); }}>
                                ← Back to History
                            </button>
                        )}
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                                Feedback Portal 📋
                            </h1>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                {activeTab !== 'manage' ? 'Manage your feedback cycle configuration and results' : 'Create and manage feedback cycles for your department'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {cycle && <StatusBadge status={cycle.status} />}
                        {cycle && (
                            <button className="btn btn-outline btn-sm" style={{ color: '#DC2626', borderColor: '#DC2626' }} onClick={() => handleDelete(cycle.id, cycle.title)}>
                                🗑️ Delete Form
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            {selectedCycleId && (
                <div style={{
                    display: 'flex', gap: 4, marginBottom: 24,
                    background: 'var(--bg-secondary)', padding: 4, borderRadius: 12,
                    width: 'fit-content',
                }}>
                    {tabs.map(t => (
                        <button key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            style={{
                                padding: '9px 20px', borderRadius: 9, fontSize: '0.835rem', fontWeight: 600,
                                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                                background: activeTab === t.id ? 'var(--bg-card)' : 'transparent',
                                color: activeTab === t.id ? 'var(--hod)' : 'var(--text-secondary)',
                                boxShadow: activeTab === t.id ? 'var(--shadow-sm)' : 'none',
                            }}
                        >{t.label}</button>
                    ))}
                </div>
            )}

            {/* Tab Content */}
            {activeTab === 'manage' && (
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Form History</h3>
                        <button className="btn btn-hod btn-sm" onClick={handleNewCycle}>+ Create New Form</button>
                    </div>
                    {cycles.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 12 }}>
                            No feedback forms created yet. Click "+ Create New Form" to begin.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Form Title</th>
                                        <th>Target</th>
                                        <th>Duration</th>
                                        <th>Response Rate</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cycles.slice().reverse().map(c => {
                                        const rate = c.totalStudents > 0 ? Math.round((c.submittedBy?.length || 0)/c.totalStudents*100) : 0;
                                        const targetLabel = c.targetYear
                                            ? `Y${c.targetYear} · Sec ${(c.targetSections || []).sort().join(', ')}`
                                            : 'All';
                                        return (
                                            <tr key={c.id}>
                                                <td style={{fontWeight:600}}>{c.title || 'Untitled Form'}</td>
                                                <td style={{fontSize:'0.8rem',fontWeight:600,color:'#1A3C6E'}}>{targetLabel}</td>
                                                <td>{c.startDate || '—'} to {c.endDate || '—'}</td>
                                                <td>{rate}% ({c.submittedBy?.length||0}/{c.totalStudents})</td>
                                                <td><StatusBadge status={c.status} /></td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <button className="btn btn-outline btn-sm" onClick={() => {
                                                            setSelectedCycleId(c.id);
                                                            setActiveTab(c.status === 'draft' ? 'create' : 'analysis');
                                                        }}>
                                                            {c.status === 'draft' ? 'Edit' : 'View Stats'}
                                                        </button>
                                                        <button className="btn btn-outline btn-sm" style={{ padding: '6px 10px', color: '#DC2626', borderColor: '#DC2626' }} title="Delete Form" onClick={() => handleDelete(c.id, c.title)}>
                                                            ✖
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'create' && (
                <CreateTab
                    key={cycle?.id || 'new'}
                    cycle={cycle}
                    onPublish={handlePublish}
                    onDraft={handleDraft}
                    onClose={handleClose}
                    actualFaculty={actualFaculty}
                    actualStudents={actualStudents}
                />
            )}
            {activeTab === 'analysis' && selectedCycleId !== null && cycle && (
                <AnalysisTab cycle={cycle} actualStudents={actualStudents} />
            )}
            {activeTab === 'analysis' && selectedCycleId !== null && !cycle && (
                <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
                    <p style={{ fontSize: '1.5rem', marginBottom: 12 }}>📊</p>
                    <p style={{ fontWeight: 600 }}>No feedback cycle found.</p>
                    <p style={{ fontSize: '0.875rem', marginTop: 6 }}>Create and publish a feedback form first to see analysis.</p>
                </div>
            )}
        </DashboardLayout>
    );
}
