import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
// imports fixed

// ─── Helpers ─────────────────────────────────────────────────────────────────
function daysRemaining(endDate) {
    const end = new Date(endDate);
    const now = new Date();
    end.setHours(23, 59, 59);
    return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── State: No Active Cycle ───────────────────────────────────────────────────
function ClosedState({ lastCycle, alreadySubmitted }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', paddingTop: 40 }}>
            <div className="card" style={{ padding: '40px 32px', textAlign: 'center', maxWidth: 480, width: '100%' }}>
                <div style={{
                    width: 72, height: 72, margin: '0 auto 20px',
                    background: 'var(--bg-secondary)', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2rem',
                }}>🔒</div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                    No Active Feedback Form
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Feedback forms are released periodically by your HOD. Check back later.
                </p>
            </div>

            {lastCycle && (
                <div className="card" style={{ padding: '20px 24px', maxWidth: 480, width: '100%' }}>
                    <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 10 }}>
                        Previous Cycle
                    </p>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{lastCycle.title}</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        {formatDate(lastCycle.startDate)} → {formatDate(lastCycle.endDate)}
                    </p>
                    <div style={{ marginTop: 12 }}>
                        {alreadySubmitted ? (
                            <span style={{
                                padding: '4px 12px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 600,
                                background: 'rgba(22,163,74,0.12)', color: '#15803D',
                            }}>✅ Submitted</span>
                        ) : (
                            <span style={{
                                padding: '4px 12px', borderRadius: 100, fontSize: '0.72rem', fontWeight: 600,
                                background: 'rgba(220,38,38,0.1)', color: '#DC2626',
                            }}>🔴 Not Submitted</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── State: Already Submitted ─────────────────────────────────────────────────
function SubmittedState({ cycle }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <div className="card" style={{ padding: '48px 36px', textAlign: 'center', maxWidth: 480, width: '100%' }}>
                <div style={{
                    width: 80, height: 80, margin: '0 auto 20px',
                    background: 'rgba(22,163,74,0.1)', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2.5rem',
                }}>✅</div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#15803D', marginBottom: 10 }}>
                    You have already submitted feedback
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Submitted for: <strong>{cycle.title}</strong>
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 12 }}>
                    Thank you for your response! Your feedback is anonymous and will help improve teaching quality.
                </p>
            </div>
        </div>
    );
}

// ─── State: Form (Not Submitted) ──────────────────────────────────────────────
function FeedbackForm({ cycle, onSubmitSuccess }) {
    const daysLeft = daysRemaining(cycle.endDate);
    const facultyInCycle = cycle.facultyDetails || [];

    // answers[facId][fieldId] = optionLabel | ''
    const [answers, setAnswers] = useState(() => {
        const init = {};
        facultyInCycle.forEach(f => {
            init[f.id] = {};
            cycle.fields.forEach(field => { init[f.id][field.id] = ''; });
        });
        return init;
    });

    const [errors, setErrors] = useState({});      // { facId: fieldId[] }
    const [showConfirm, setShowConfirm] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const fieldRefs = useRef({});

    const setAnswer = (facId, fieldId, val) => {
        setAnswers(prev => ({
            ...prev,
            [facId]: { ...prev[facId], [fieldId]: val }
        }));
        // Clear error for this field
        setErrors(prev => {
            const n = { ...prev };
            if (n[facId]) n[facId] = n[facId].filter(id => id !== fieldId);
            return n;
        });
    };

    const validate = () => {
        const newErrors = {};
        let firstError = null;
        facultyInCycle.forEach(fac => {
            cycle.fields.forEach(field => {
                if (!answers[fac.id]?.[field.id]) {
                    if (!newErrors[fac.id]) newErrors[fac.id] = [];
                    newErrors[fac.id].push(field.id);
                    if (!firstError) firstError = `${fac.id}_${field.id}`;
                }
            });
        });
        setErrors(newErrors);
        if (firstError && fieldRefs.current[firstError]) {
            fieldRefs.current[firstError].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validate()) setShowConfirm(true);
    };

    const confirmSubmit = () => {
        // Ratings stored as aggregates ONLY — no student ID linked to individual answers
        setShowConfirm(false);
        setSubmitted(true);
        setTimeout(() => onSubmitSuccess(answers), 200);
    };

    if (submitted) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
                <div className="card" style={{ padding: '48px 36px', textAlign: 'center', maxWidth: 480, width: '100%' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#15803D', marginBottom: 10 }}>
                        Thank you! Your feedback has been submitted successfully.
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        Your responses are anonymous and will help improve teaching quality.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Confirm Modal */}
            {showConfirm && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 5000, background: 'var(--overlay)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                }}>
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: 16, maxWidth: 400, width: '100%',
                        padding: '28px 28px 24px', boxShadow: 'var(--shadow-xl)', animation: 'scaleIn 0.2s ease',
                    }}>
                        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: 14 }}>⚠️</div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 10 }}>
                            Submit Feedback?
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, textAlign: 'center' }}>
                            Once submitted, you cannot edit or re-submit your feedback. Are you sure you want to submit?
                        </p>
                        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowConfirm(false)}>
                                Go Back
                            </button>
                            <button className="btn btn-student" style={{ flex: 1 }} onClick={confirmSubmit}>
                                Yes, Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760, margin: '0 auto' }}>
                {/* Open Banner */}
                <div style={{
                    padding: '14px 20px', borderRadius: 12,
                    background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
                }}>
                    <div>
                        <p style={{ fontWeight: 700, color: '#15803D', fontSize: '0.9rem' }}>📋 Feedback form is OPEN</p>
                        <p style={{ fontSize: '0.78rem', color: '#15803D', marginTop: 2 }}>
                            Closes on {formatDate(cycle.endDate)} · {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
                        </p>
                    </div>
                </div>

                {/* Form title + anonymity notice */}
                <div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{cycle.title}</h2>
                    <div style={{
                        padding: '12px 16px', borderRadius: 10,
                        background: 'rgba(26,60,110,0.06)', border: '1px solid rgba(26,60,110,0.12)',
                    }}>
                        <p style={{ fontSize: '0.82rem', color: '#1A3C6E', fontWeight: 500, lineHeight: 1.6 }}>
                            🔒 <strong>Your feedback is completely anonymous.</strong> Your name will not be associated with your ratings in any way. Please answer honestly.
                        </p>
                    </div>
                </div>

                {/* Faculty Sections */}
                {facultyInCycle.map(fac => {
                    const facErrors = errors[fac.id] || [];
                    const hasError = facErrors.length > 0;
                    return (
                        <div key={fac.id} className="card" style={{
                            overflow: 'hidden',
                            border: hasError ? '1.5px solid rgba(220,38,38,0.4)' : '1px solid var(--border)',
                        }}>
                            {/* Faculty header */}
                            <div style={{
                                padding: '16px 20px', background: 'var(--bg-secondary)',
                                borderBottom: '1px solid var(--border)',
                            }}>
                                <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                    👨‍🏫 {fac.name}
                                </p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                    {fac.designation} · {fac.subjects.join(', ')}
                                </p>
                            </div>

                            {/* Inline error summary */}
                            {hasError && (
                                <div style={{ padding: '10px 20px', background: 'rgba(220,38,38,0.06)', borderBottom: '1px solid rgba(220,38,38,0.15)' }}>
                                    <p style={{ fontSize: '0.78rem', color: '#B91C1C', fontWeight: 600 }}>
                                        ⚠ Please rate all fields for {fac.name}
                                    </p>
                                </div>
                            )}

                            {/* Fields */}
                            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {cycle.fields.map(field => {
                                    const isFieldError = facErrors.includes(field.id);
                                    const refKey = `${fac.id}_${field.id}`;
                                    return (
                                        <div key={field.id}
                                            ref={el => { if (el) fieldRefs.current[refKey] = el; }}
                                            style={{ padding: isFieldError ? '14px 14px' : '0', borderRadius: 8, background: isFieldError ? 'rgba(220,38,38,0.04)' : 'transparent', border: isFieldError ? '1px solid rgba(220,38,38,0.2)' : 'none', transition: 'all 0.2s' }}>
                                            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: isFieldError ? '#B91C1C' : 'var(--text-primary)', marginBottom: 10 }}>
                                                {field.label}
                                                {isFieldError && <span style={{ fontSize: '0.72rem', marginLeft: 8, color: '#DC2626' }}>* Required</span>}
                                            </p>
                                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                                {field.options.map(opt => {
                                                    const selected = answers[fac.id]?.[field.id] === opt;
                                                    return (
                                                        <label key={opt} style={{
                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                            cursor: 'pointer', padding: '8px 16px', borderRadius: 8,
                                                            border: `1.5px solid ${selected ? 'var(--student)' : 'var(--border)'}`,
                                                            background: selected ? 'rgba(106,27,154,0.08)' : 'var(--bg-secondary)',
                                                            transition: 'all 0.15s',
                                                            fontSize: '0.85rem', fontWeight: selected ? 600 : 400,
                                                            color: selected ? 'var(--student)' : 'var(--text-secondary)',
                                                        }}>
                                                            <input
                                                                type="radio"
                                                                name={`${fac.id}_${field.id}`}
                                                                value={opt}
                                                                checked={selected}
                                                                onChange={() => setAnswer(fac.id, field.id, opt)}
                                                                style={{ display: 'none' }}
                                                            />
                                                            {selected ? '◉' : '○'} {opt}
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {/* Submit Button */}
                <div style={{ padding: '8px 0 24px', display: 'flex', justifyContent: 'center' }}>
                    <button className="btn btn-student" style={{ minWidth: 200, fontSize: '0.95rem' }} onClick={handleSubmit}>
                        Submit Feedback ✔
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function StudentFeedback() {
    const { user } = useAuth();
    
    // Read from localStorage
    const LS_KEY = 'vignan_hod_feedback_cycle_cse';
    const [cycles, setCycles] = useState(() => {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch { return []; }
    });

    const [hasSubmitted, setHasSubmitted] = useState(false);

    // Find the active cycle for the student's dept (CSE)
    const now = new Date();
    const activeCycle = cycles.find(c => {
        if (c.dept !== 'CSE' || c.status !== 'active') return false;
        if (new Date(c.startDate) > now || new Date(c.endDate + 'T23:59:59') < now) return false;
        // Year & section targeting (backward-compatible: if not set, visible to all)
        const studentYear = user?.year;
        const studentSection = user?.section;
        if (c.targetYear && studentYear && c.targetYear !== studentYear) return false;
        if (c.targetSections?.length && studentSection && !c.targetSections.includes(studentSection)) return false;
        return true;
    }) || null;

    // Check if student already submitted
    const rollNumber = user?.login_id || user?.roll_number || '';
    const alreadySubmitted = activeCycle
        ? activeCycle.submittedBy.includes(rollNumber) || hasSubmitted
        : false;

    // For history: find any cycle (active or closed)
    const lastCycle = cycles.filter(c => c.dept === 'CSE').sort((a,b) => b.id.localeCompare(a.id))[0] || null;
    const lastSubmitted = lastCycle ? lastCycle.submittedBy.includes(rollNumber) : false;

    const handleSubmitSuccess = (answers) => {
        setHasSubmitted(true);
        // Persist response to localStorage so HOD can see it
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return;
            let currentCycles = JSON.parse(raw);
            if (!Array.isArray(currentCycles)) currentCycles = [currentCycles];
            
            const activeIdx = currentCycles.findIndex(c => c.id === activeCycle.id);
            if (activeIdx === -1) return;
            
            const current = currentCycles[activeIdx];
            
            if (!current.submittedBy) current.submittedBy = [];
            if (!current.submittedBy.includes(rollNumber)) {
                current.submittedBy.push(rollNumber);
            }
            
            if (!current.ratings) current.ratings = {};
            for (const [facId, facAnswers] of Object.entries(answers)) {
                if (!current.ratings[facId]) current.ratings[facId] = {};
                for (const [fieldId, opt] of Object.entries(facAnswers)) {
                    if (!current.ratings[facId][fieldId]) current.ratings[facId][fieldId] = {};
                    current.ratings[facId][fieldId][opt] = (current.ratings[facId][fieldId][opt] || 0) + 1;
                }
            }
            
            currentCycles[activeIdx] = current;
            localStorage.setItem(LS_KEY, JSON.stringify(currentCycles));
        } catch (e) {
            console.error('Failed to save feedback:', e);
        }
    };

    return (
        <DashboardLayout>
            {/* Page Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                    Feedback 📋
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Rate your faculty to help improve teaching quality
                </p>
            </div>

            {/* Render correct state */}
            {!activeCycle && (
                <ClosedState lastCycle={lastCycle} alreadySubmitted={lastSubmitted} />
            )}
            {activeCycle && (alreadySubmitted) && (
                <SubmittedState cycle={activeCycle} />
            )}
            {activeCycle && !alreadySubmitted && (
                <FeedbackForm cycle={activeCycle} onSubmitSuccess={handleSubmitSuccess} />
            )}
        </DashboardLayout>
    );
}
