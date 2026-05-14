import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';

// ─── Toast ──────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success', onDone }) {
    useEffect(() => { const t = setTimeout(onDone, 5000); return () => clearTimeout(t); }, [onDone]);
    const bg = type === 'success' ? '#16A34A' : type === 'error' ? '#DC2626' : '#1565C0';
    return (
        <div style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 9999, background: bg, color: 'white',
            borderRadius: 12, padding: '14px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            fontSize: '0.875rem', fontWeight: 600, maxWidth: 420, animation: 'slideUp 0.3s ease',
        }}>{message}</div>
    );
}

// ─── Cross-Faculty Popup ────────────────────────────────────────────────────
function CrossFacultyPopup({ ownerName, onConfirm, onCancel }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 18, padding: '32px 36px', maxWidth: 440, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.35)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '2.2rem', marginBottom: 12, textAlign: 'center' }}>⚠️</div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 10px' }}>
                    Records Entered by Another Faculty
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.6 }}>
                    Some marks for this subject were already entered by <strong style={{ color: 'var(--text-primary)' }}>{ownerName}</strong>.
                    Saving will overwrite their entries. Are you sure you want to continue?
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={onCancel} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button onClick={onConfirm} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#DC2626,#EF4444)', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                        Yes, Overwrite
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Grade calculator ───────────────────────────────────────────────────────
function gradeFor(marks, max) {
    if (marks === '' || marks == null) return { label: '—', color: 'var(--text-secondary)' };
    const pct = (parseFloat(marks) / max) * 100;
    if (pct >= 90) return { label: 'O', color: '#16A34A' };
    if (pct >= 80) return { label: 'A+', color: '#16A34A' };
    if (pct >= 70) return { label: 'A', color: '#16A34A' };
    if (pct >= 60) return { label: 'B+', color: '#F59E0B' };
    if (pct >= 50) return { label: 'B', color: '#F59E0B' };
    if (pct >= 40) return { label: 'C', color: '#F59E0B' };
    return { label: 'F ⚠', color: '#DC2626' };
}

// ─── Shared Subject + Section Selector ─────────────────────────────────────
function SubjectSelector({ assignments, selected, onSelect }) {
    return (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            {assignments.map(a => (
                <button key={a.id} onClick={() => onSelect(a.id)} style={{
                    padding: '8px 16px', borderRadius: 10, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                    border: `1.5px solid ${selected === a.id ? 'var(--primary)' : 'var(--border)'}`,
                    background: selected === a.id ? 'rgba(21,101,192,0.1)' : 'var(--bg-card)',
                    color: selected === a.id ? 'var(--primary)' : 'var(--text-secondary)',
                }}>
                    {a.subject_name} · Y{a.year}{a.section}
                </button>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1 — MARKS ENTRY
// ═══════════════════════════════════════════════════════════════════════════
function MarksTab({ assignments }) {
    const [selectedId, setSelectedId] = useState(assignments[0]?.id || null);
    const [examType, setExamType] = useState('internal');
    const [examLabel, setExamLabel] = useState('');
    const [maxMarks, setMaxMarks] = useState(100);
    const [entries, setEntries] = useState([]);
    const [saving, setSaving] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [popup, setPopup] = useState(null);
    const [backlogs, setBacklogs] = useState([]);

    const addToast = (message, type = 'success') => { const id = Date.now(); setToasts(p => [...p, { id, message, type }]); };
    const removeToast = (id) => setToasts(p => p.filter(t => t.id !== id));

    useEffect(() => { if (selectedId) loadStudents(); }, [selectedId]);

    const loadStudents = async () => {
        setBacklogs([]); setEntries([]);
        try {
            const r = await api.get(`/faculty/attendance/percentage/${selectedId}`);
            setEntries((r.data.students || []).map(s => ({ student_id: s.student_id, name: s.full_name, roll: s.roll_number, marks_obtained: '' })));
        } catch { }
    };

    const doSubmit = async () => {
        const assign = assignments.find(a => a.id === selectedId);
        setSaving(true);
        try {
            await api.post('/faculty/marks', {
                subject_id: assign.subject_id,
                semester: assign.semester || 1,
                exam_type: examType,
                exam_label: examLabel,
                entries: entries.filter(e => e.marks_obtained !== '').map(e => ({
                    student_id: e.student_id,
                    marks_obtained: parseFloat(e.marks_obtained),
                    max_marks: maxMarks,
                })),
            });
            const detected = entries.filter(e => e.marks_obtained !== '' && (parseFloat(e.marks_obtained) / maxMarks) * 100 < 40)
                .map(e => ({ name: e.name, roll: e.roll, subject: assign.subject_name, marks: e.marks_obtained, max: maxMarks }));
            setBacklogs(detected);
            if (detected.length > 0) addToast(`⚠ ${detected.length} student(s) failed — alerts queued.`, 'error');
            else addToast('Marks saved successfully! Students can now view them.');
        } catch (err) { addToast(err.response?.data?.error || 'Error saving marks', 'error'); }
        finally { setSaving(false); }
    };

    const handleSubmit = async () => {
        if (!selectedId || !examLabel) return addToast('Select subject and enter exam label.', 'error');
        if (entries.filter(e => e.marks_obtained !== '').length === 0) return addToast('Enter at least one student\'s marks.', 'error');
        try {
            const r = await api.get(`/faculty/marks/check/${selectedId}`);
            const others = (r.data.marks || []).filter(m => m.entered_by_other == 1 && m.exam_label === examLabel);
            if (others.length > 0) {
                setPopup({ ownerName: others[0].entered_by_name, pendingSubmit: doSubmit });
                return;
            }
        } catch { }
        doSubmit();
    };

    return (
        <>
            {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} onDone={() => removeToast(t.id)} />)}
            {popup && <CrossFacultyPopup ownerName={popup.ownerName} onConfirm={() => { setPopup(null); popup.pendingSubmit(); }} onCancel={() => setPopup(null)} />}

            <SubjectSelector assignments={assignments} selected={selectedId} onSelect={(id) => { setSelectedId(id); }} />

            {backlogs.length > 0 && (
                <div style={{ borderRadius: 12, padding: '14px 18px', marginBottom: 20, background: 'rgba(220,38,38,0.07)', border: '1.5px solid rgba(220,38,38,0.25)' }}>
                    <p style={{ fontWeight: 700, color: '#B91C1C', marginBottom: 8, fontSize: '0.88rem' }}>⚠ Backlog Detected</p>
                    {backlogs.map((b, i) => (
                        <p key={i} style={{ fontSize: '0.8rem', color: '#B91C1C', margin: '3px 0' }}>
                            {b.name} ({b.roll}) — {b.subject} — {b.marks}/{b.max} ({((b.marks / b.max) * 100).toFixed(1)}%) → Grade F
                        </p>
                    ))}
                </div>
            )}

            <div style={{ padding: 20, borderRadius: 14, marginBottom: 20, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Exam Type</label>
                        <select className="form-input" value={examType} onChange={e => setExamType(e.target.value)}>
                            <option value="internal">Internal</option>
                            <option value="external">External</option>
                            <option value="assignment">Assignment</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Exam Label</label>
                        <input className="form-input" placeholder="e.g. Mid 1" value={examLabel} onChange={e => setExamLabel(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Max Marks</label>
                        <input type="number" className="form-input" value={maxMarks} onChange={e => setMaxMarks(parseInt(e.target.value) || 100)} />
                    </div>
                </div>
            </div>

            {entries.length > 0 && (
                <>
                    <div style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <table className="data-table">
                            <thead><tr><th>Roll No</th><th>Name</th><th>Marks ({maxMarks})</th><th>Grade</th></tr></thead>
                            <tbody>
                                {entries.map((e, i) => {
                                    const g = gradeFor(e.marks_obtained, maxMarks);
                                    return (
                                        <tr key={e.student_id}>
                                            <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{e.roll}</span></td>
                                            <td>{e.name}</td>
                                            <td><input type="number" className="form-input" style={{ width: 100 }} min={0} max={maxMarks} value={e.marks_obtained}
                                                onChange={ev => { const ne = [...entries]; ne[i].marks_obtained = ev.target.value; setEntries(ne); }} /></td>
                                            <td><span style={{ padding: '3px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, background: g.color === '#DC2626' ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.1)', color: g.color }}>{g.label}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={handleSubmit} disabled={saving || !examLabel} style={{
                            padding: '12px 28px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer',
                            background: saving ? 'var(--border)' : 'linear-gradient(135deg,#1565C0,#42A5F5)', color: 'white',
                        }}>{saving ? 'Saving…' : 'Submit Marks'}</button>
                    </div>
                </>
            )}
            {selectedId && entries.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No students found for this assignment.</p>
                </div>
            )}
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2 — VIEW / EDIT MY MARKS
// ═══════════════════════════════════════════════════════════════════════════
function ViewMarksTab({ assignments }) {
    const [selectedId, setSelectedId] = useState(null); // null = all subjects
    const [allMarks, setAllMarks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editId, setEditId] = useState(null);
    const [editVal, setEditVal] = useState({ marks_obtained: '', max_marks: '' });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'one'|'all', mark?, subject_id?, exam_label?, label? }
    const [toasts, setToasts] = useState([]);
    const [filterExam, setFilterExam] = useState('');

    const addToast = (msg, type = 'success') => { const id = Date.now(); setToasts(p => [...p, { id, msg, type }]); };

    const loadMarks = useCallback(async () => {
        setLoading(true);
        try {
            const params = selectedId ? `?assignment_id=${selectedId}` : '';
            const r = await api.get(`/faculty/marks/all${params}`);
            setAllMarks(r.data.marks || []);
        } catch {
            addToast('Failed to load marks', 'error');
        } finally {
            setLoading(false);
        }
    }, [selectedId]);

    useEffect(() => { loadMarks(); }, [loadMarks]);

    const startEdit = (m) => {
        setEditId(m.id);
        setEditVal({ marks_obtained: m.marks_obtained, max_marks: m.max_marks });
    };

    const saveEdit = async (m) => {
        setSaving(true);
        try {
            await api.put(`/faculty/marks/${m.id}`, {
                marks_obtained: parseFloat(editVal.marks_obtained),
                max_marks: parseFloat(editVal.max_marks),
            });
            addToast('Mark updated successfully!');
            setEditId(null);
            loadMarks();
        } catch (err) {
            addToast(err.response?.data?.error || 'Error updating mark', 'error');
        } finally {
            setSaving(false);
        }
    };

    const deleteOne = async () => {
        if (!confirmDelete || confirmDelete.type !== 'one') return;
        setDeleting(true);
        try {
            await api.delete(`/faculty/marks/${confirmDelete.mark.id}`);
            addToast('Mark record deleted.');
            setConfirmDelete(null);
            loadMarks();
        } catch (err) {
            addToast(err.response?.data?.error || 'Error deleting mark', 'error');
        } finally { setDeleting(false); }
    };

    const deleteAll = async () => {
        if (!confirmDelete || confirmDelete.type !== 'all') return;
        setDeleting(true);
        try {
            await api.delete('/faculty/marks/bulk', { data: { subject_id: confirmDelete.subject_id, exam_label: confirmDelete.exam_label } });
            addToast(`All marks for ${confirmDelete.label} deleted.`);
            setConfirmDelete(null);
            loadMarks();
        } catch (err) {
            addToast(err.response?.data?.error || 'Error deleting marks', 'error');
        } finally { setDeleting(false); }
    };

    // Group by subject + exam for summary cards
    const examTypes = [...new Set(allMarks.map(m => m.exam_type))];
    const examLabels = [...new Set(allMarks.map(m => m.exam_label))];

    const filtered = allMarks.filter(m => !filterExam || m.exam_label === filterExam);

    // Summary: group by subject_name + exam_label
    const summaryMap = {};
    filtered.forEach(m => {
        const key = `${m.subject_name}||${m.exam_label}`;
        if (!summaryMap[key]) summaryMap[key] = { subject_name: m.subject_name, exam_type: m.exam_type, exam_label: m.exam_label, count: 0, total_marks: 0, max_marks: m.max_marks };
        summaryMap[key].count++;
        summaryMap[key].total_marks += parseFloat(m.marks_obtained);
    });
    const summaries = Object.values(summaryMap);

    return (
        <>
            {toasts.map(t => <Toast key={t.id} message={t.msg} type={t.type} onDone={() => setToasts(p => p.filter(x => x.id !== t.id))} />)}

            {/* ── Confirm Delete Modal ── */}
            {confirmDelete && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--bg-card)', borderRadius: 18, padding: '32px 36px', maxWidth: 420, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,0.35)', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '2.2rem', marginBottom: 12, textAlign: 'center' }}>🗑️</div>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 10px' }}>
                            {confirmDelete.type === 'all' ? 'Delete All Marks?' : 'Delete This Mark?'}
                        </h2>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 8px', lineHeight: 1.6 }}>
                            {confirmDelete.type === 'all'
                                ? <><strong>{confirmDelete.label}</strong> — all <strong>{confirmDelete.count}</strong> student records will be permanently deleted. This cannot be undone.</>
                                : <>Delete marks for <strong>{confirmDelete.mark.full_name}</strong> ({confirmDelete.mark.exam_label} · {confirmDelete.mark.marks_obtained}/{confirmDelete.mark.max_marks})? This cannot be undone.</>
                            }
                        </p>
                        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                            <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={confirmDelete.type === 'all' ? deleteAll : deleteOne} disabled={deleting} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: deleting ? '#9CA3AF' : 'linear-gradient(135deg,#DC2626,#EF4444)', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: deleting ? 'not-allowed' : 'pointer' }}>
                                {deleting ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
                    <button onClick={() => setSelectedId(null)} style={{
                        padding: '7px 14px', borderRadius: 9, fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                        border: `1.5px solid ${selectedId === null ? 'var(--primary)' : 'var(--border)'}`,
                        background: selectedId === null ? 'rgba(21,101,192,0.1)' : 'var(--bg-card)',
                        color: selectedId === null ? 'var(--primary)' : 'var(--text-secondary)',
                    }}>All Subjects</button>
                    {assignments.map(a => (
                        <button key={a.id} onClick={() => setSelectedId(a.id)} style={{
                            padding: '7px 14px', borderRadius: 9, fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer',
                            border: `1.5px solid ${selectedId === a.id ? 'var(--primary)' : 'var(--border)'}`,
                            background: selectedId === a.id ? 'rgba(21,101,192,0.1)' : 'var(--bg-card)',
                            color: selectedId === a.id ? 'var(--primary)' : 'var(--text-secondary)',
                        }}>{a.subject_name} · Y{a.year}{a.section}</button>
                    ))}
                </div>
                {examLabels.length > 0 && (
                    <select className="form-input" style={{ width: 180 }} value={filterExam} onChange={e => setFilterExam(e.target.value)}>
                        <option value="">All Exams</option>
                        {examLabels.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                )}
                <button onClick={loadMarks} style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>
                    🔄 Refresh
                </button>
            </div>

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center' }}><LoadingSpinner /></div>
            ) : filtered.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '2rem', marginBottom: 8 }}>📋</p>
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>No marks entered yet.</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginTop: 4 }}>Use the "Enter Marks" tab to add marks for your students.</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    {summaries.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
                            {summaries.map((s, i) => {
                                const avg = s.count > 0 ? (s.total_marks / s.count).toFixed(1) : 0;
                                const avgPct = s.max_marks > 0 ? ((s.total_marks / s.count / s.max_marks) * 100).toFixed(1) : 0;
                                const color = avgPct >= 75 ? '#16A34A' : avgPct >= 50 ? '#F59E0B' : '#DC2626';
                                // Find subject_id for bulk delete
                                const sampleMark = filtered.find(m => m.subject_name === s.subject_name && m.exam_label === s.exam_label);
                                return (
                                    <div key={i} style={{ padding: '16px 18px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.exam_type}</p>
                                        <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: 2 }}>{s.subject_name}</p>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>{s.exam_label}</p>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.count} students</span>
                                            <span style={{ fontWeight: 800, fontSize: '1rem', color }}>{avgPct}%</span>
                                        </div>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 10 }}>Class avg: {avg}/{s.max_marks}</p>
                                        {sampleMark && !sampleMark.locked && (
                                            <button
                                                onClick={() => setConfirmDelete({ type: 'all', subject_id: sampleMark.subject_id, exam_label: s.exam_label, label: `${s.subject_name} — ${s.exam_label}`, count: s.count })}
                                                style={{ width: '100%', padding: '6px 0', borderRadius: 8, border: '1.5px solid rgba(220,38,38,0.35)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                                            >🗑 Delete All ({s.count}) Records</button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Marks Table */}
                    <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Roll No</th>
                                    <th>Student Name</th>
                                    <th>Subject</th>
                                    <th>Exam Type</th>
                                    <th>Exam Label</th>
                                    <th>Marks</th>
                                    <th>%</th>
                                    <th>Grade</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(m => {
                                    const isEditing = editId === m.id;
                                    const pct = isEditing
                                        ? (editVal.marks_obtained && editVal.max_marks ? ((parseFloat(editVal.marks_obtained) / parseFloat(editVal.max_marks)) * 100).toFixed(1) : '—')
                                        : m.max_marks > 0 ? ((m.marks_obtained / m.max_marks) * 100).toFixed(1) : '—';
                                    const g = gradeFor(
                                        isEditing ? editVal.marks_obtained : m.marks_obtained,
                                        isEditing ? editVal.max_marks : m.max_marks
                                    );
                                    const pctColor = parseFloat(pct) >= 75 ? '#16A34A' : parseFloat(pct) >= 50 ? '#F59E0B' : '#DC2626';
                                    return (
                                        <tr key={m.id} style={{ background: isEditing ? 'rgba(21,101,192,0.04)' : undefined }}>
                                            <td><span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem' }}>{m.roll_number}</span></td>
                                            <td style={{ fontWeight: 500 }}>{m.full_name}</td>
                                            <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{m.subject_name}</td>
                                            <td>
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize',
                                                    background: m.exam_type === 'internal' ? 'rgba(21,101,192,0.1)' : m.exam_type === 'external' ? 'rgba(220,38,38,0.1)' : 'rgba(245,158,11,0.1)',
                                                    color: m.exam_type === 'internal' ? '#1565C0' : m.exam_type === 'external' ? '#DC2626' : '#B45309',
                                                }}>{m.exam_type}</span>
                                            </td>
                                            <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>{m.exam_label}</td>
                                            <td>
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                        <input type="number" className="form-input" style={{ width: 72 }} min={0} max={editVal.max_marks}
                                                            value={editVal.marks_obtained} onChange={e => setEditVal(v => ({ ...v, marks_obtained: e.target.value }))} />
                                                        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                                                        <input type="number" className="form-input" style={{ width: 72 }} min={1}
                                                            value={editVal.max_marks} onChange={e => setEditVal(v => ({ ...v, max_marks: e.target.value }))} />
                                                    </div>
                                                ) : (
                                                    <span style={{ fontWeight: 700 }}>{m.marks_obtained}/{m.max_marks}</span>
                                                )}
                                            </td>
                                            <td>
                                                <span style={{ color: pctColor, fontWeight: 600 }}>{pct}%</span>
                                            </td>
                                            <td>
                                                <span style={{
                                                    padding: '3px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                                                    background: g.color === '#DC2626' ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.1)',
                                                    color: g.color,
                                                }}>{g.label}</span>
                                            </td>
                                            <td>
                                                {m.locked ? (
                                                    <span style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700 }}>🔒 Locked</span>
                                                ) : (
                                                    <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700 }}>✓ Published</span>
                                                )}
                                            </td>
                                            <td>
                                                {m.locked ? (
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>—</span>
                                                ) : isEditing ? (
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button onClick={() => saveEdit(m)} disabled={saving} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#16A34A,#22C55E)', color: 'white', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>{saving ? '…' : 'Save'}</button>
                                                        <button onClick={() => setEditId(null)} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}>Cancel</button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button onClick={() => startEdit(m)} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid var(--primary)', background: 'rgba(21,101,192,0.08)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>✏ Edit</button>
                                                        <button onClick={() => setConfirmDelete({ type: 'one', mark: m })} style={{ padding: '5px 12px', borderRadius: 8, border: '1.5px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}>🗑 Delete</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                        Showing {filtered.length} record{filtered.length !== 1 ? 's' : ''} · All marks are visible to students
                    </p>
                </>
            )}
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3 — BACKLOGS
// ═══════════════════════════════════════════════════════════════════════════
function BacklogsTab({ assignments }) {
    const [selectedId, setSelectedId] = useState(assignments[0]?.id || null);
    const [students, setStudents] = useState([]);
    const [entries, setEntries] = useState({});
    const [saving, setSaving] = useState(false);
    const [toasts, setToasts] = useState([]);

    const addToast = (msg, type = 'success') => { const id = Date.now(); setToasts(p => [...p, { id, msg, type }]); };

    // Load students + merge existing backlog data into entries
    useEffect(() => {
        if (!selectedId) return;
        const assign = assignments.find(a => a.id === selectedId);

        Promise.all([
            api.get(`/faculty/attendance/percentage/${selectedId}`).catch(() => ({ data: { students: [] } })),
            api.get(`/faculty/backlogs/${selectedId}`).catch(() => ({ data: { backlogs: [] } })),
        ]).then(([studRes, backlogRes]) => {
            const studs = studRes.data.students || [];
            const existingList = backlogRes.data.backlogs || [];

            // Build lookup: student_id → backlog row
            const existingMap = {};
            existingList.forEach(b => { existingMap[b.student_id] = b; });

            setStudents(studs);

            // Init entries — pre-populate with existing data if available
            const init = {};
            studs.forEach(s => {
                const ex = existingMap[s.student_id];
                init[s.student_id] = {
                    student_id: s.student_id,
                    backlog_count: ex ? ex.backlog_count : 1,
                    subject_names_text: ex ? (ex.subject_names_text || '') : '',
                    backlog_type: ex ? (ex.backlog_type || 'academic') : 'academic',
                    reason: ex ? (ex.reason || '') : '',
                    marked: !!ex,           // auto-check if existing
                    hasExisting: !!ex,      // track if this is an update
                    semester: assign?.semester || 1,
                };
            });
            setEntries(init);
        });
    }, [selectedId]);

    const handleToggle = (sid) => setEntries(p => ({ ...p, [sid]: { ...p[sid], marked: !p[sid].marked } }));
    const handleField = (sid, field, val) => setEntries(p => ({ ...p, [sid]: { ...p[sid], [field]: val } }));

    // Immediately remove a single student's backlog
    const handleRemoveOne = async (sid) => {
        setSaving(true);
        try {
            await api.post('/faculty/backlogs/remove-bulk', { student_ids: [sid] });
            addToast('✅ Backlog removed successfully.');
            setEntries(p => ({
                ...p,
                [sid]: { ...p[sid], marked: false, hasExisting: false, subject_names_text: '', reason: '', backlog_count: 1 }
            }));
        } catch (err) {
            addToast(err.response?.data?.error || 'Error removing backlog', 'error');
        } finally { setSaving(false); }
    };

    const handleSave = async () => {
        setSaving(true);
        const toSave = Object.values(entries).filter(e => e.marked);
        const toRemove = Object.values(entries).filter(e => !e.marked && e.hasExisting);
        const noCount = toSave.filter(e => !e.backlog_count || parseInt(e.backlog_count) < 1);
        if (noCount.length > 0) {
            addToast('Please enter a backlog count (≥ 1) for all checked students.', 'error');
            setSaving(false); return;
        }
        if (toSave.length === 0 && toRemove.length === 0) { addToast('No changes to save.', 'error'); setSaving(false); return; }
        try {
            // Step 1: remove unchecked existing backlogs
            if (toRemove.length > 0) {
                await api.post('/faculty/backlogs/remove-bulk', { student_ids: toRemove.map(e => e.student_id) });
            }
            // Step 2: save/update checked backlogs
            if (toSave.length > 0) {
                await api.post('/faculty/backlogs', {
                    entries: toSave.map(e => ({
                        student_id: e.student_id,
                        backlog_count: parseInt(e.backlog_count) || 1,
                        subject_names_text: (e.subject_names_text || '').trim() || null,
                        semester: e.semester,
                        backlog_type: e.backlog_type,
                        reason: e.reason,
                    }))
                });
            }
            const updates = toSave.filter(e => e.hasExisting).length;
            const news = toSave.filter(e => !e.hasExisting).length;
            const parts = [news > 0 && `${news} new`, updates > 0 && `${updates} updated`, toRemove.length > 0 && `${toRemove.length} removed`].filter(Boolean).join(', ');
            addToast(`✅ Backlogs saved — ${parts}.`);

            // Refresh from server
            const r = await api.get(`/faculty/backlogs/${selectedId}`).catch(() => ({ data: { backlogs: [] } }));
            const refreshed = r.data.backlogs || [];
            const refreshedMap = {};
            refreshed.forEach(b => { refreshedMap[b.student_id] = b; });
            setEntries(p => {
                const next = { ...p };
                Object.keys(next).forEach(sid => {
                    const ex = refreshedMap[Number(sid)];
                    next[sid] = {
                        ...next[sid],
                        hasExisting: !!ex,
                        marked: !!ex,
                        backlog_count: ex ? ex.backlog_count : 1,
                        subject_names_text: ex ? (ex.subject_names_text || '') : '',
                        backlog_type: ex ? (ex.backlog_type || 'academic') : 'academic',
                        reason: ex ? (ex.reason || '') : '',
                    };
                });
                return next;
            });
        } catch (err) { addToast(err.response?.data?.error || 'Error saving backlogs', 'error'); }
        finally { setSaving(false); }
    };

    const markedCount = Object.values(entries).filter(e => e.marked).length;
    const updateCount = Object.values(entries).filter(e => e.marked && e.hasExisting).length;
    const newCount = markedCount - updateCount;
    const removeCount = Object.values(entries).filter(e => !e.marked && e.hasExisting).length;
    const hasChanges = markedCount > 0 || removeCount > 0;

    return (
        <>
            {toasts.map(t => <Toast key={t.id} message={t.msg} type={t.type} onDone={() => setToasts(p => p.filter(x => x.id !== t.id))} />)}
            <SubjectSelector assignments={assignments} selected={selectedId} onSelect={setSelectedId} />

            {/* Info banner */}
            <div style={{ padding: '10px 16px', borderRadius: 10, marginBottom: 16, background: 'rgba(21,101,192,0.06)', border: '1px solid rgba(21,101,192,0.15)', fontSize: '0.8rem', color: '#1565C0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>ℹ</span>
                <span>Students with existing backlogs are pre-checked. <strong>Uncheck</strong> to remove a backlog, or click <strong>🗑 Remove</strong>. Edit inline and click <strong>Update Backlogs</strong>.</span>
            </div>

            {/* Pending-remove warning */}
            {removeCount > 0 && (
                <div style={{ padding: '10px 16px', borderRadius: 10, marginBottom: 16, background: 'rgba(220,38,38,0.07)', border: '1.5px solid rgba(220,38,38,0.3)', fontSize: '0.8rem', color: '#B91C1C', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>⚠</span>
                    <span>{removeCount} student backlog{removeCount !== 1 ? 's' : ''} will be <strong>permanently removed</strong> when you click Save.</span>
                </div>
            )}

            {students.length > 0 ? (
                <>
                    <div style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 44 }}>✓</th>
                                    <th>Roll No</th>
                                    <th>Name</th>
                                    <th style={{ width: 90 }}>Count</th>
                                    <th>Subject Names</th>
                                    <th style={{ width: 140 }}>Type</th>
                                    <th>Reason</th>
                                    <th style={{ width: 80 }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(s => {
                                    const e = entries[s.student_id] || {};
                                    const isUpdate = e.hasExisting;
                                    return (
                                        <tr key={s.student_id} style={{
                                            background: e.marked
                                                ? (isUpdate ? 'rgba(234,179,8,0.04)' : 'rgba(220,38,38,0.03)')
                                                : undefined,
                                            verticalAlign: 'middle',
                                        }}>
                                            <td style={{ textAlign: 'center' }}>
                                                <input type="checkbox" checked={!!e.marked} onChange={() => handleToggle(s.student_id)}
                                                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: isUpdate ? '#B45309' : '#DC2626' }} />
                                            </td>
                                            <td>
                                                <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.82rem' }}>{s.roll_number}</span>
                                            </td>
                                            <td>
                                                <span style={{
                                                    fontWeight: e.marked ? 700 : 400,
                                                    color: e.marked ? (isUpdate ? '#B45309' : '#DC2626') : undefined,
                                                }}>
                                                    {s.full_name}
                                                </span>
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    style={{ width: 68, padding: '4px 8px', fontSize: '0.85rem', textAlign: 'center' }}
                                                    min={1} max={20}
                                                    value={e.backlog_count ?? 1}
                                                    disabled={!e.marked}
                                                    onChange={ev => handleField(s.student_id, 'backlog_count', ev.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    className="form-input"
                                                    style={{ padding: '4px 8px', fontSize: '0.8rem', width: '100%', minWidth: 180 }}
                                                    placeholder={e.marked ? 'e.g. Maths, Physics, DBMS' : '—'}
                                                    value={e.subject_names_text || ''}
                                                    disabled={!e.marked}
                                                    onChange={ev => handleField(s.student_id, 'subject_names_text', ev.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <select className="form-input" style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                                    value={e.backlog_type || 'academic'}
                                                    onChange={ev => handleField(s.student_id, 'backlog_type', ev.target.value)}
                                                    disabled={!e.marked}>
                                                    <option value="academic">Academic</option>
                                                    <option value="attendance">Attendance</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </td>
                                            <td>
                                                <input className="form-input" style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                                    placeholder="Reason (optional)"
                                                    value={e.reason || ''}
                                                    onChange={ev => handleField(s.student_id, 'reason', ev.target.value)}
                                                    disabled={!e.marked} />
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {e.hasExisting && !e.marked ? (
                                                    <span style={{
                                                        padding: '2px 8px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 800,
                                                        background: 'rgba(220,38,38,0.12)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.3)',
                                                        whiteSpace: 'nowrap', display: 'inline-block',
                                                    }}>🗑 REMOVE</span>
                                                ) : isUpdate ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                        <span style={{
                                                            padding: '2px 8px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 800,
                                                            background: 'rgba(234,179,8,0.12)', color: '#B45309', border: '1px solid rgba(234,179,8,0.3)',
                                                            whiteSpace: 'nowrap',
                                                        }}>✏ UPDATE</span>
                                                        <button
                                                            onClick={() => handleRemoveOne(s.student_id)}
                                                            disabled={saving}
                                                            title="Remove this backlog immediately"
                                                            style={{
                                                                padding: '2px 8px', borderRadius: 6, fontSize: '0.62rem', fontWeight: 700,
                                                                background: 'rgba(220,38,38,0.1)', color: '#DC2626',
                                                                border: '1px solid rgba(220,38,38,0.25)', cursor: 'pointer',
                                                                whiteSpace: 'nowrap',
                                                            }}>
                                                            🗑 Remove
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Save/Update bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <p style={{ fontSize: '0.78rem', color: removeCount > 0 ? '#DC2626' : 'var(--text-tertiary)', fontWeight: removeCount > 0 ? 600 : 400 }}>
                            {hasChanges
                                ? [
                                    markedCount > 0 && `${markedCount} student${markedCount !== 1 ? 's' : ''} selected`,
                                    updateCount > 0 && `${updateCount} will be updated`,
                                    newCount > 0 && `${newCount} new`,
                                    removeCount > 0 && `${removeCount} will be REMOVED`,
                                  ].filter(Boolean).join(' · ')
                                : 'Check students to assign backlogs, or uncheck existing ones to remove them'}
                        </p>
                        <button onClick={handleSave} disabled={saving || !hasChanges} style={{
                            padding: '12px 28px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: '0.9rem',
                            cursor: (saving || !hasChanges) ? 'not-allowed' : 'pointer',
                            opacity: !hasChanges ? 0.5 : 1,
                            background: saving ? 'var(--border)'
                                : removeCount > 0 && markedCount === 0 ? 'linear-gradient(135deg,#DC2626,#EF4444)'
                                : removeCount > 0 ? 'linear-gradient(135deg,#7C3AED,#A855F7)'
                                : updateCount === markedCount && markedCount > 0 ? 'linear-gradient(135deg,#B45309,#F59E0B)'
                                : 'linear-gradient(135deg,#DC2626,#EF4444)',
                            color: 'white', transition: 'all 0.2s',
                        }}>
                            {saving ? 'Saving…'
                                : removeCount > 0 && markedCount === 0 ? `Remove ${removeCount} Backlog${removeCount !== 1 ? 's' : ''}`
                                : removeCount > 0 ? `Save & Remove (${removeCount} removed)`
                                : updateCount > 0 && newCount === 0 ? `Update ${updateCount} Backlog${updateCount !== 1 ? 's' : ''}`
                                : updateCount > 0 ? 'Save & Update Backlogs'
                                : `Save ${newCount} Backlog${newCount !== 1 ? 's' : ''}`}
                        </button>
                    </div>
                </>
            ) : (
                <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Select a subject to see students.</p>
                </div>
            )}
        </>
    );
}



// ═══════════════════════════════════════════════════════════════════════════
// TAB 4 — CGPA / SGPA
// ═══════════════════════════════════════════════════════════════════════════

function CgpaTab({ assignments }) {
    const [selectedId, setSelectedId] = useState(assignments[0]?.id || null);
    const [students, setStudents] = useState([]);
    const [entries, setEntries] = useState({});
    const [saving, setSaving] = useState(false);
    const [toasts, setToasts] = useState([]);

    const addToast = (msg, type = 'success') => { const id = Date.now(); setToasts(p => [...p, { id, msg, type }]); };

    useEffect(() => {
        if (!selectedId) return;
        setStudents([]);
        api.get(`/faculty/cgpa/${selectedId}`)
            .then(r => {
                const studs = r.data.students || [];
                setStudents(studs);
                const init = {};
                studs.forEach(s => { init[s.student_id] = { cgpa: s.cgpa ?? '', sgpa: s.sgpa ?? '' }; });
                setEntries(init);
            }).catch(() => { });
    }, [selectedId]);

    const handleField = (sid, field, val) => setEntries(p => ({ ...p, [sid]: { ...p[sid], [field]: val } }));

    const handleSave = async () => {
        setSaving(true);
        const assign = assignments.find(a => a.id === selectedId);
        const toSave = students
            .filter(s => entries[s.student_id]?.cgpa !== '' || entries[s.student_id]?.sgpa !== '')
            .map(s => ({
                student_id: s.student_id,
                cgpa: entries[s.student_id]?.cgpa !== '' ? parseFloat(entries[s.student_id]?.cgpa) : null,
                sgpa: entries[s.student_id]?.sgpa !== '' ? parseFloat(entries[s.student_id]?.sgpa) : null,
                semester: assign?.semester || 1,
            }));
        if (toSave.length === 0) { addToast('No entries to save.', 'error'); setSaving(false); return; }
        try {
            await api.post('/faculty/cgpa', { entries: toSave });
            addToast(`CGPA/SGPA saved for ${toSave.length} student(s).`);
        } catch (err) { addToast(err.response?.data?.error || 'Error saving CGPA', 'error'); }
        finally { setSaving(false); }
    };

    const cgpaColor = (v) => { const n = parseFloat(v); return n >= 8 ? '#16A34A' : n >= 6 ? '#F59E0B' : n >= 4 ? '#DC2626' : 'var(--text-secondary)'; };

    return (
        <>
            {toasts.map(t => <Toast key={t.id} message={t.msg} type={t.type} onDone={() => setToasts(p => p.filter(x => x.id !== t.id))} />)}
            <SubjectSelector assignments={assignments} selected={selectedId} onSelect={setSelectedId} />

            <div style={{ padding: '10px 16px', borderRadius: 10, marginBottom: 18, background: 'rgba(21,101,192,0.07)', border: '1px solid rgba(21,101,192,0.2)', fontSize: '0.8rem', color: '#1565C0', fontWeight: 600 }}>
                ℹ Enter CGPA (Cumulative) and SGPA (this semester) manually. These will appear on the student dashboard.
            </div>

            {students.length > 0 ? (
                <>
                    <div style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <table className="data-table">
                            <thead><tr><th>Roll No</th><th>Name</th><th>CGPA (0–10)</th><th>SGPA (0–10)</th><th>Status</th></tr></thead>
                            <tbody>
                                {students.map(s => {
                                    const e = entries[s.student_id] || {};
                                    return (
                                        <tr key={s.student_id}>
                                            <td><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.roll_number}</span></td>
                                            <td>{s.full_name}</td>
                                            <td>
                                                <input type="number" className="form-input" style={{ width: 90 }} min={0} max={10} step={0.01} placeholder="e.g. 7.5" value={e.cgpa ?? ''} onChange={ev => handleField(s.student_id, 'cgpa', ev.target.value)} />
                                            </td>
                                            <td>
                                                <input type="number" className="form-input" style={{ width: 90 }} min={0} max={10} step={0.01} placeholder="e.g. 8.2" value={e.sgpa ?? ''} onChange={ev => handleField(s.student_id, 'sgpa', ev.target.value)} />
                                            </td>
                                            <td>
                                                {e.cgpa !== '' && e.cgpa != null ? (
                                                    <span style={{ fontWeight: 700, color: cgpaColor(e.cgpa), fontSize: '0.85rem' }}>{parseFloat(e.cgpa) >= 7 ? '🟢 Good' : parseFloat(e.cgpa) >= 5 ? '🟡 Average' : '🔴 Low'}</span>
                                                ) : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>Not set</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={handleSave} disabled={saving} style={{ padding: '12px 28px', borderRadius: 12, border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? 'var(--border)' : 'linear-gradient(135deg,#1565C0,#42A5F5)', color: 'white' }}>
                            {saving ? 'Saving…' : 'Save CGPA / SGPA'}
                        </button>
                    </div>
                </>
            ) : (
                <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Select a subject/section to manage CGPA.</p>
                </div>
            )}
        </>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
export default function FacultyMarks() {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('marks');

    useEffect(() => {
        api.get('/faculty/assignments')
            .then(r => setAssignments(r.data.assignments || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const tabStyle = (t) => ({
        padding: '9px 20px', borderRadius: 10, border: `1.5px solid ${activeTab === t ? 'var(--primary)' : 'var(--border)'}`,
        background: activeTab === t ? 'rgba(21,101,192,0.1)' : 'var(--bg-card)',
        color: activeTab === t ? 'var(--primary)' : 'var(--text-secondary)',
        fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s ease',
    });

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Marks & Academic Records</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>Enter marks, view & edit your entries, manage backlogs, and update CGPA/SGPA</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
                <button style={tabStyle('marks')} onClick={() => setActiveTab('marks')}>📝 Enter Marks</button>
                <button style={tabStyle('view')} onClick={() => setActiveTab('view')}>📋 View / Edit My Marks</button>
                <button style={tabStyle('backlogs')} onClick={() => setActiveTab('backlogs')}>⚠ Backlogs</button>
                <button style={tabStyle('cgpa')} onClick={() => setActiveTab('cgpa')}>🎓 CGPA / SGPA</button>
            </div>

            {assignments.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>📋</p>
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>No subjects assigned yet.</p>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginTop: 4 }}>Contact your HOD to get subjects assigned.</p>
                </div>
            ) : (
                <>
                    {activeTab === 'marks' && <MarksTab assignments={assignments} />}
                    {activeTab === 'view' && <ViewMarksTab assignments={assignments} />}
                    {activeTab === 'backlogs' && <BacklogsTab assignments={assignments} />}
                    {activeTab === 'cgpa' && <CgpaTab assignments={assignments} />}
                </>
            )}
        </DashboardLayout>
    );
}
