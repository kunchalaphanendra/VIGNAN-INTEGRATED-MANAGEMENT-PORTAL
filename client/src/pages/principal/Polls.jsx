import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell,
} from 'recharts';

const COLORS = ['#1565C0', '#2E7D32', '#E8A020', '#D84315', '#6A1B9A', '#00838F', '#AD1457', '#37474F'];

function QuestionChart({ question, responses }) {
    const qResponses = responses.filter(r => r.question_id === question.id);
    const total = qResponses.length;

    if (question.question_type === 'multiple_choice') {
        const opts = question.options
            ? (typeof question.options === 'string' ? JSON.parse(question.options) : question.options)
            : [];
        const counts = {};
        opts.forEach(o => { counts[o] = 0; });
        qResponses.forEach(r => { if (r.selected_option && counts[r.selected_option] !== undefined) counts[r.selected_option]++; });
        const data = opts.map(o => ({
            name: o,
            count: counts[o],
            pct: total > 0 ? Math.round((counts[o] / total) * 100) : 0
        }));

        return (
            <div style={{ marginTop: 14 }}>
                {data.map((d, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{d.name}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{d.count} votes ({d.pct}%)</span>
                        </div>
                        <div style={{ background: 'var(--border)', borderRadius: 99, height: 10, overflow: 'hidden' }}>
                            <div style={{
                                width: `${d.pct}%`, height: '100%', borderRadius: 99,
                                background: COLORS[i % COLORS.length],
                                transition: 'width 0.6s ease',
                                minWidth: d.pct > 0 ? 6 : 0,
                            }} />
                        </div>
                    </div>
                ))}
                {data.length > 1 && (
                    <div style={{ marginTop: 16, height: Math.max(120, data.length * 36) }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} layout="vertical" margin={{ left: 4, right: 36, top: 4, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={90} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem' }}
                                    formatter={(val) => [`${val} votes`, 'Count']}
                                />
                                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                                    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        );
    }

    if (question.question_type === 'rating') {
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let sum = 0;
        qResponses.forEach(r => {
            const v = parseInt(r.rating_value || r.response_text || r.selected_option);
            if (v >= 1 && v <= 5) { counts[v]++; sum += v; }
        });
        const avg = total > 0 ? (sum / total).toFixed(1) : '—';
        const data = [1, 2, 3, 4, 5].map(n => ({ name: `${n} ★`, count: counts[n] }));

        return (
            <div style={{ marginTop: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    background: 'var(--bg-card)', borderRadius: 12, padding: '12px 20px',
                    border: '1px solid var(--border)', minWidth: 80,
                }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: '#E8A020', lineHeight: 1 }}>{avg}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4 }}>avg / 5</span>
                    <div style={{ fontSize: '1.1rem', marginTop: 4 }}>
                        {'★'.repeat(Math.round(parseFloat(avg) || 0))}{'☆'.repeat(5 - Math.round(parseFloat(avg) || 0))}
                    </div>
                </div>
                <div style={{ flex: 1, height: 150 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                            <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} allowDecimals={false} />
                            <Tooltip
                                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem' }}
                                formatter={(val) => [`${val} responses`, '']}
                            />
                            <Bar dataKey="count" fill="#E8A020" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    // Open text
    return (
        <div style={{ marginTop: 10, maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {qResponses.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontStyle: 'italic' }}>No responses yet</p>
            ) : qResponses.map((r, i) => (
                <div key={i} style={{
                    padding: '8px 12px', borderRadius: 8,
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5,
                }}>
                    💬 {r.response_text || r.selected_option || '(empty)'}
                </div>
            ))}
        </div>
    );
}

export default function Polls() {
    const [polls, setPolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showResults, setShowResults] = useState(null);
    const [results, setResults] = useState(null);
    const [form, setForm] = useState({
        title: '', description: '', is_anonymous: false,
        open_date: '', close_date: '',
        questions: [{ question_text: '', question_type: 'multiple_choice', options: [''] }]
    });

    useEffect(() => { load(); }, []);
    const load = async () => {
        try { const r = await api.get('/principal/polls'); setPolls(r.data.polls); } catch { } finally { setLoading(false); }
    };

    const viewResults = async (id) => {
        try { const r = await api.get(`/principal/polls/${id}/results`); setResults(r.data); setShowResults(id); } catch { }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try { await api.post('/principal/polls', form); setShowModal(false); load(); } catch (err) { alert(err.response?.data?.error || 'Error'); }
    };

    const addQuestion = () => setForm({ ...form, questions: [...form.questions, { question_text: '', question_type: 'multiple_choice', options: [''] }] });
    const updateQuestion = (qi, key, val) => { const qs = [...form.questions]; qs[qi][key] = val; setForm({ ...form, questions: qs }); };
    const updateOption = (qi, oi, val) => { const qs = [...form.questions]; qs[qi].options[oi] = val; setForm({ ...form, questions: qs }); };
    const addOption = (qi) => { const qs = [...form.questions]; qs[qi].options.push(''); setForm({ ...form, questions: qs }); };

    // Response rate helpers
    const uniqueRespondents = (responses) => [...new Set((responses || []).map(r => r.respondent_id).filter(Boolean))].length;

    const columns = [
        { key: 'title', header: 'Title', accessor: 'title' },
        { key: 'open', header: 'Opens', accessor: r => new Date(r.open_date).toLocaleDateString() },
        { key: 'close', header: 'Closes', accessor: r => new Date(r.close_date).toLocaleDateString() },
        {
            key: 'responses', header: 'Responses', render: r => (
                <span style={{ color: '#1565C0', fontWeight: 600 }}>{r.response_count}/{r.total_faculty}</span>
            )
        },
        {
            key: 'actions', header: '', sortable: false, render: r => (
                <button onClick={() => viewResults(r.id)} className="btn btn-sm btn-outline">Results</button>
            )
        }
    ];

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Opinion Polls</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Create and manage faculty feedback polls</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-principal">+ Create Poll</button>
            </div>

            <DataTable columns={columns} data={polls} />

            {/* Create Poll Modal */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create New Poll" size="lg">
                <form onSubmit={handleCreate} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Poll Details</p>
                        <div className="form-group">
                            <label className="form-label">Poll Title <span className="required">*</span></label>
                            <input className="form-input" placeholder="e.g. Faculty Satisfaction Survey 2026" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea className="form-input" placeholder="Brief description of the poll" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
                        </div>
                    </div>
                    <div className="modal-section">
                        <p className="modal-section-title">Schedule</p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Open Date <span className="required">*</span></label>
                                <input type="date" className="form-input" value={form.open_date} onChange={e => setForm({ ...form, open_date: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Close Date <span className="required">*</span></label>
                                <input type="date" className="form-input" value={form.close_date} onChange={e => setForm({ ...form, close_date: e.target.value })} required />
                            </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <input type="checkbox" checked={form.is_anonymous} onChange={e => setForm({ ...form, is_anonymous: e.target.checked })} style={{ width: 16, height: 16 }} />
                            Anonymous responses
                        </label>
                    </div>
                    <div className="modal-section">
                        <p className="modal-section-title">Questions</p>
                        {form.questions.map((q, qi) => (
                            <div key={qi} style={{ padding: 16, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', marginBottom: 12 }}>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Question {qi + 1} <span className="required">*</span></label>
                                    <input className="form-input" placeholder={`Enter question ${qi + 1}`} value={q.question_text} onChange={e => updateQuestion(qi, 'question_text', e.target.value)} required />
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Type</label>
                                    <select className="form-input" value={q.question_type} onChange={e => updateQuestion(qi, 'question_type', e.target.value)}>
                                        <option value="multiple_choice">Multiple Choice</option>
                                        <option value="rating">Rating (1–5)</option>
                                        <option value="open_text">Open Text</option>
                                    </select>
                                </div>
                                {q.question_type === 'multiple_choice' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label className="form-label">Options</label>
                                        {q.options.map((o, oi) => (
                                            <div key={oi} style={{ display: 'flex', gap: 8 }}>
                                                <input className="form-input" placeholder={`Option ${oi + 1}`} value={o} onChange={e => updateOption(qi, oi, e.target.value)} style={{ flex: 1 }} />
                                                {oi === q.options.length - 1 && (<button type="button" onClick={() => addOption(qi)} className="btn btn-sm btn-outline">+</button>)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={addQuestion} className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}>
                            + Add Another Question
                        </button>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-principal">Create Poll</button>
                    </div>
                </form>
            </Modal>

            {/* Results Modal with Charts */}
            <Modal isOpen={!!showResults} onClose={() => setShowResults(null)} title="Poll Results & Analytics" size="lg">
                {results && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {/* Stats row */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                            {[
                                { label: 'Responded', value: uniqueRespondents(results.responses), color: '#1565C0' },
                                { label: 'Total Faculty', value: results.poll?.total_faculty || '—', color: '#2E7D32' },
                                {
                                    label: 'Response Rate',
                                    value: results.poll?.total_faculty
                                        ? Math.round((uniqueRespondents(results.responses) / results.poll.total_faculty) * 100) + '%'
                                        : '—',
                                    color: '#E8A020'
                                },
                            ].map(s => (
                                <div key={s.label} style={{
                                    padding: '14px 16px', borderRadius: 12, textAlign: 'center',
                                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                }}>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 4 }}>{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Progress bar */}
                        {results.poll?.total_faculty > 0 && (() => {
                            const pct = Math.min(100, Math.round((uniqueRespondents(results.responses) / results.poll.total_faculty) * 100));
                            return (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                        <span>Response Progress</span>
                                        <span>{uniqueRespondents(results.responses)} of {results.poll.total_faculty}</span>
                                    </div>
                                    <div style={{ background: 'var(--border)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${pct}%`, height: '100%',
                                            background: 'linear-gradient(90deg, #1565C0, #42A5F5)',
                                            borderRadius: 99, transition: 'width 0.8s ease',
                                        }} />
                                    </div>
                                </div>
                            );
                        })()}

                        <div style={{ height: 1, background: 'var(--border)' }} />

                        {/* Per-question charts */}
                        {results.questions?.length > 0 ? results.questions.map((q, idx) => (
                            <div key={q.id} style={{
                                padding: 18, borderRadius: 14,
                                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 2 }}>
                                    <span style={{
                                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                        background: COLORS[idx % COLORS.length], color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.72rem', fontWeight: 700, marginTop: 1,
                                    }}>{idx + 1}</span>
                                    <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', flex: 1 }}>{q.question_text}</p>
                                    <span style={{
                                        padding: '2px 8px', borderRadius: 99,
                                        background: 'rgba(107,114,128,0.1)', color: 'var(--text-secondary)',
                                        fontSize: '0.7rem', fontWeight: 500, whiteSpace: 'nowrap',
                                    }}>
                                        {(results.responses || []).filter(r => r.question_id === q.id).length} responses
                                    </span>
                                </div>
                                <QuestionChart question={q} responses={results.responses || []} />
                            </div>
                        )) : (
                            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.875rem' }}>No questions found for this poll</p>
                        )}
                    </div>
                )}
            </Modal>
        </DashboardLayout>
    );
}
