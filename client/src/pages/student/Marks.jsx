import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { SkeletonGrid } from '../../components/SkeletonCard';
import PrintButton from '../../components/PrintButton';
import api from '../../utils/api';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { HiChevronDown, HiChevronUp } from 'react-icons/hi';

/* ── helpers ── */
function gradeFromPct(p) {
    if (p >= 90) return 'O';
    if (p >= 80) return 'A+';
    if (p >= 70) return 'A';
    if (p >= 60) return 'B+';
    if (p >= 50) return 'B';
    if (p >= 40) return 'C';
    return 'F';
}
const GRADE_STYLE = {
    O:  { bg: 'rgba(22,163,74,0.13)',  color: '#15803D' },
    'A+':{ bg: 'rgba(21,101,192,0.13)', color: '#1565C0' },
    A:  { bg: 'rgba(30,136,229,0.12)', color: '#1E88E5' },
    'B+':{ bg: 'rgba(124,58,237,0.12)', color: '#7C3AED' },
    B:  { bg: 'rgba(79,70,229,0.12)',  color: '#4F46E5' },
    C:  { bg: 'rgba(180,83,9,0.12)',   color: '#B45309' },
    F:  { bg: 'rgba(220,38,38,0.12)',  color: '#DC2626' },
};
const gs = g => GRADE_STYLE[g] || { bg: 'rgba(100,116,139,0.1)', color: '#64748B' };
const pc = p => p >= 75 ? '#16A34A' : p >= 50 ? '#F59E0B' : '#DC2626';
const PURPLE = '#6A1B9A';




function groupMarks(marks, classAvgData = []) {
    const map = {};
    marks.forEach(m => {
        const k = m.subject_name;
        if (!map[k]) map[k] = { name: k, code: m.code, entries: [] };
        map[k].entries.push({ ...m, marks_obtained: +m.marks_obtained, max_marks: +m.max_marks });
    });

    return Object.values(map).map(sub => {
        const tot = sub.entries.reduce((s, e) => s + e.marks_obtained, 0);
        const totMax = sub.entries.reduce((s, e) => s + e.max_marks, 0);
        const avgPct = totMax > 0 ? (tot / totMax) * 100 : 0;

        const trendData = sub.entries.map(e => ({
            name: e.exam_label,
            'Your Marks': Math.round(e.marks_obtained / e.max_marks * 100),
        }));

        const barData = sub.entries.map(e => {
            const ca = classAvgData.find(c => c.subject_name === sub.name && c.exam_label === e.exam_label);
            const obj = { name: e.exam_label, 'Your Marks': Math.round(e.marks_obtained / e.max_marks * 100) };
            if (ca) obj['Class Avg'] = Math.round(+ca.class_avg_percentage);
            return obj;
        });

        const chips = sub.entries.map(e => e.exam_label);
        const hasClassAvg = barData.some(d => 'Class Avg' in d);

        return { ...sub, avgPct, grade: gradeFromPct(avgPct), chips, trendData, barData, hasClassAvg, tot, totMax };
    });
}

/* ── MarksSummary ── */
function MarksSummary({ subject }) {
    const { entries } = subject;
    return (
        <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 14 }}>Marks Summary</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {entries.map((e, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{e.exam_label}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: PURPLE }}>{e.marks_obtained}/{e.max_marks}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}


/* ── SubjectCard ── */
function SubjectCard({ subject, index, isExpanded, onToggle }) {
    const { avgPct, grade } = subject;
    const gStyle = gs(grade);
    const latest = subject.entries[subject.entries.length - 1];
    const displayScore = latest ? `${latest.marks_obtained.toFixed(2)}/${latest.max_marks}` : '--/--';

    return (
        <div style={{ borderRadius: 14, background: 'var(--bg-card)', border: isExpanded ? `2px solid ${PURPLE}` : '1.5px solid var(--border)', boxShadow: isExpanded ? `0 4px 20px rgba(106,27,154,0.12)` : 'var(--shadow-sm)', transition: 'all 0.25s', overflow: 'hidden' }}>
            {/* Header */}
            <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: isExpanded ? PURPLE : 'rgba(106,27,154,0.1)', color: isExpanded ? 'white' : PURPLE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.875rem', flexShrink: 0, transition: 'all 0.2s' }}>{index}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0 }}>{subject.name}</p>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {subject.chips.map((c, i) => (
                                <span key={i} style={{ padding: '2px 8px', borderRadius: 100, fontSize: '0.65rem', fontWeight: 700, background: 'rgba(106,27,154,0.08)', color: PURPLE }}>{c}</span>
                            ))}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0 }}>{displayScore}</p>
                        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: pc(avgPct), margin: 0 }}>{avgPct.toFixed(1)}%</p>
                    </div>
                    <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 800, background: gStyle.bg, color: gStyle.color }}>{grade}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{isExpanded ? <HiChevronUp size={18} /> : <HiChevronDown size={18} />}</span>
                </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
                <div style={{ borderTop: `1.5px solid rgba(106,27,154,0.15)`, padding: '20px', animation: 'fadeIn 0.25s ease' }}>
                    <div className="stat-grid-3" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1fr) minmax(220px,1.6fr) minmax(220px,1.6fr)', gap: 20 }}>

                        {/* A: Marks Summary */}
                        <div style={{ padding: '16px', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                            <MarksSummary subject={subject} />
                        </div>

                        {/* B: Performance Trend */}
                        <div style={{ padding: '16px', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 14 }}>Performance Trend</p>
                            {subject.trendData.length < 1 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: 30 }}>No data yet</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={160}>
                                    <LineChart data={subject.trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.78rem' }} />
                                        <Line type="monotone" dataKey="Your Marks" stroke={PURPLE} strokeWidth={2.5} dot={{ r: 5, fill: PURPLE, strokeWidth: 0 }} activeDot={{ r: 7 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* C: Marks Comparison */}
                        <div style={{ padding: '16px', borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)', marginBottom: 14 }}>Marks Comparison</p>
                            {subject.barData.length < 1 ? (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center', paddingTop: 30 }}>No data yet</p>
                            ) : (
                                <ResponsiveContainer width="100%" height={160}>
                                    <BarChart data={subject.barData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barCategoryGap="30%">
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.78rem' }} />
                                        {subject.hasClassAvg && <Legend iconSize={10} wrapperStyle={{ fontSize: '0.72rem' }} />}
                                        <Bar dataKey="Your Marks" fill={PURPLE} radius={[4, 4, 0, 0]} />
                                        {subject.hasClassAvg && <Bar dataKey="Class Avg" fill="#94A3B8" radius={[4, 4, 0, 0]} />}
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Main Page ── */
export default function StudentMarks() {
    const [marks, setMarks] = useState([]);
    const [backlogs, setBacklogs] = useState([]);
    const [classAvgData, setClassAvgData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedSubject, setExpandedSubject] = useState(null);
    const [expandAll, setExpandAll] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const [mRes, bRes, perfRes] = await Promise.all([
                    api.get('/student/marks'),
                    api.get('/student/backlogs').catch(() => ({ data: { backlogs: [] } })),
                    api.get('/student/performance').catch(() => ({ data: { class_average: [] } })),
                ]);
                setMarks(mRes.data.marks || []);
                setBacklogs(bRes.data.backlogs || []);
                setClassAvgData(perfRes.data.class_average || []);
            } catch { }
            finally { setLoading(false); }
        })();
    }, []);

    const subjects = groupMarks(marks, classAvgData);
    const filtered = subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    const facultyBacklogCount = backlogs.reduce((s, b) => s + (+b.backlog_count || 1), 0);

    const isOpen = (name) => expandAll || expandedSubject === name;

    const toggleCard = (name) => {
        if (expandAll) return;
        setExpandedSubject(prev => prev === name ? null : name);
    };

    if (loading) return (
        <DashboardLayout>
            <div style={{ marginBottom: 20 }}><SkeletonGrid count={3} /></div>
            <div style={{ marginBottom: 20 }}><SkeletonGrid count={3} /></div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
            <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>My Marks</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 3 }}>View your exam results, trends and subject-wise performance</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <PrintButton label="Download PDF" size="sm" />
                    {/* Search */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 14px', minWidth: 200 }}>
                        <svg width="15" height="15" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subject..." style={{ border: 'none', outline: 'none', background: 'none', fontSize: '0.85rem', color: 'var(--text-primary)', width: '100%' }} />
                    </div>
                    {/* Expand All */}
                    <button onClick={() => { setExpandAll(p => !p); setExpandedSubject(null); }} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${PURPLE}`, background: expandAll ? PURPLE : 'transparent', color: expandAll ? 'white' : PURPLE, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                        {expandAll ? 'Collapse All' : 'Expand All'}
                    </button>
                </div>
            </div>

            {/* Backlog Banner */}
            {facultyBacklogCount > 0 && (
                <div style={{ borderRadius: 14, marginBottom: 20, background: 'rgba(220,38,38,0.06)', border: '1.5px solid rgba(220,38,38,0.25)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', background: 'rgba(220,38,38,0.06)', borderBottom: '1px solid rgba(220,38,38,0.15)' }}>
                        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 800, color: '#B91C1C', fontSize: '0.9rem', margin: 0 }}>Active Backlogs Assigned by Faculty</p>
                            <p style={{ fontSize: '0.75rem', color: '#DC2626', margin: 0, marginTop: 2 }}>Please contact your HOD or faculty for clearance</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {backlogs.map((b, i) => (
                                <span key={i} style={{ padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 700, background: 'rgba(220,38,38,0.1)', color: '#B91C1C', border: '1px solid rgba(220,38,38,0.2)' }}>
                                    {b.backlog_count} Backlog · {b.subject_names_text || b.backlog_type}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Subject Cards */}
            {filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                    {search ? `No subjects matching "${search}"` : 'No marks published yet.'}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {filtered.map((sub, idx) => (
                        <SubjectCard
                            key={sub.name}
                            subject={sub}
                            index={idx + 1}
                            isExpanded={isOpen(sub.name)}
                            onToggle={() => toggleCard(sub.name)}
                        />
                    ))}
                </div>
            )}

            <p style={{ marginTop: 24, fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                ℹ️ Graphs and summaries update as marks are entered by faculty.
            </p>
        </DashboardLayout>
    );
}
