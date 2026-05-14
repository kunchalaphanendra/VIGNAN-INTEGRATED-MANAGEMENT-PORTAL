import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import { HiOutlineClipboardList, HiOutlineCheckCircle } from 'react-icons/hi';

export default function FacultyPolls() {
    const [polls, setPolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [voteModal, setVoteModal] = useState(null); // { poll, questions }
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [answers, setAnswers] = useState({});    // { question_id: value }
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { load(); }, []);
    const load = async () => {
        try {
            const r = await api.get('/faculty/polls');
            setPolls(r.data.polls || []);
        } catch { } finally { setLoading(false); }
    };

    const openVote = async (poll) => {
        setLoadingQuestions(true);
        try {
            const r = await api.get(`/faculty/polls/${poll.id}/questions`);
            if (r.data.already_responded) {
                alert('You have already submitted your response to this poll.');
                return;
            }
            const initAnswers = {};
            r.data.questions.forEach(q => { initAnswers[q.id] = ''; });
            setAnswers(initAnswers);
            setVoteModal({ poll: r.data.poll, questions: r.data.questions });
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to load poll');
        } finally { setLoadingQuestions(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const responses = Object.entries(answers).map(([qid, val]) => ({
                question_id: parseInt(qid),
                response_text: val,
                selected_option: val,
                rating_value: null,
            }));
            await api.post(`/faculty/polls/${voteModal.poll.id}/respond`, { responses });
            setVoteModal(null);
            load(); // refresh to update "My Status"
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to submit response');
        } finally { setSubmitting(false); }
    };

    const isActive = (poll) => {
        const today = new Date(); today.setHours(12, 0, 0, 0);
        const close = new Date(poll.close_date); close.setHours(23, 59, 59, 999);
        const open = new Date(poll.open_date); open.setHours(0, 0, 0, 0);
        return today >= open && today <= close;
    };

    const columns = [
        {
            key: 'title', header: 'Title', accessor: 'title',
            render: r => <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{r.title}</span>
        },
        {
            key: 'open_date', header: 'Opens',
            render: r => <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{new Date(r.open_date).toLocaleDateString()}</span>
        },
        {
            key: 'close_date', header: 'Closes',
            render: r => <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{new Date(r.close_date).toLocaleDateString()}</span>
        },
        {
            key: 'status', header: 'Status',
            render: r => {
                const active = isActive(r);
                return (
                    <span style={{
                        padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600,
                        background: active ? 'rgba(21,128,61,0.1)' : 'rgba(107,114,128,0.1)',
                        color: active ? '#15803D' : '#6B7280',
                    }}>{active ? 'Active' : 'Closed'}</span>
                );
            }
        },
        {
            key: 'my_status', header: 'My Status',
            render: r => r.my_responses > 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#15803D', fontWeight: 600, fontSize: '0.8rem' }}>
                    <HiOutlineCheckCircle size={15} /> Submitted
                </span>
            ) : (
                <span style={{ color: '#DC2626', fontSize: '0.8rem', fontWeight: 600 }}>Pending</span>
            )
        },
        {
            key: 'action', header: '',
            render: r => isActive(r) && r.my_responses === 0 ? (
                <button
                    onClick={() => openVote(r)}
                    disabled={loadingQuestions}
                    style={{
                        padding: '7px 18px', borderRadius: 8, border: 'none',
                        background: '#1565C0', color: 'white',
                        fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                        transition: 'opacity 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    {loadingQuestions ? 'Loading…' : 'Vote Now'}
                </button>
            ) : null
        },
    ];

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Opinion Polls</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>Polls assigned to faculty by the Principal</p>
            </div>

            {polls.length === 0 ? (
                <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 14, padding: '48px 24px', textAlign: 'center',
                }}>
                    <HiOutlineClipboardList size={36} color="var(--text-tertiary)" style={{ marginBottom: 12 }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No polls have been assigned yet</p>
                </div>
            ) : (
                <DataTable columns={columns} data={polls} />
            )}

            {/* Voting Modal */}
            {voteModal && (
                <Modal isOpen={!!voteModal} onClose={() => setVoteModal(null)} title={`Vote: ${voteModal.poll.title}`} size="md">
                    <form onSubmit={handleSubmit}>
                        {voteModal.poll.description && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                                {voteModal.poll.description}
                            </p>
                        )}
                        {voteModal.poll.is_anonymous && (
                            <div style={{
                                padding: '8px 12px', borderRadius: 8, marginBottom: 20,
                                background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.2)',
                                fontSize: '0.78rem', color: '#15803D', fontWeight: 500,
                            }}>🔒 This poll is anonymous — your identity will not be recorded</div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {voteModal.questions.map((q, idx) => {
                                const opts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [];
                                return (
                                    <div key={q.id} style={{
                                        background: 'var(--bg-secondary)', borderRadius: 12, padding: '16px',
                                        border: '1px solid var(--border)'
                                    }}>
                                        <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: 12 }}>
                                            {idx + 1}. {q.question_text} <span style={{ color: '#DC2626' }}>*</span>
                                        </p>

                                        {q.question_type === 'multiple_choice' && opts.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {opts.map((opt, oi) => (
                                                    <label key={oi} style={{
                                                        display: 'flex', alignItems: 'center', gap: 10,
                                                        padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                                                        border: `1.5px solid ${answers[q.id] === opt ? '#1565C0' : 'var(--border)'}`,
                                                        background: answers[q.id] === opt ? 'rgba(21,101,192,0.08)' : 'var(--bg-card)',
                                                        transition: 'all 0.15s ease',
                                                    }}>
                                                        <input
                                                            type="radio" name={`q_${q.id}`} value={opt}
                                                            checked={answers[q.id] === opt}
                                                            onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                                                            required
                                                            style={{ accentColor: '#1565C0' }}
                                                        />
                                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: answers[q.id] === opt ? 600 : 400 }}>{opt}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : q.question_type === 'rating' ? (
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                                {[1, 2, 3, 4, 5].map(n => (
                                                    <button key={n} type="button"
                                                        onClick={() => setAnswers(a => ({ ...a, [q.id]: String(n) }))}
                                                        style={{
                                                            width: 44, height: 44, borderRadius: 10, border: '1.5px solid',
                                                            borderColor: answers[q.id] === String(n) ? '#1565C0' : 'var(--border)',
                                                            background: answers[q.id] === String(n) ? '#1565C0' : 'var(--bg-card)',
                                                            color: answers[q.id] === String(n) ? 'white' : 'var(--text-primary)',
                                                            fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                                                            transition: 'all 0.15s ease',
                                                        }}
                                                    >{n}</button>
                                                ))}
                                            </div>
                                        ) : (
                                            <textarea
                                                className="form-input"
                                                rows={3}
                                                placeholder="Write your answer here…"
                                                value={answers[q.id] || ''}
                                                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                                                required
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                            <button type="button" onClick={() => setVoteModal(null)}
                                style={{
                                    padding: '10px 20px', borderRadius: 10,
                                    border: '1.5px solid var(--border)', background: 'var(--bg-card)',
                                    color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer',
                                }}>Cancel</button>
                            <button type="submit" disabled={submitting}
                                style={{
                                    padding: '10px 24px', borderRadius: 10, border: 'none',
                                    background: submitting ? '#9CA3AF' : '#1565C0', color: 'white',
                                    fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
                                }}>
                                {submitting ? 'Submitting…' : 'Submit Vote'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </DashboardLayout>
    );
}
