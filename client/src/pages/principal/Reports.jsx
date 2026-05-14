import { useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { HiOutlineDocumentReport, HiOutlineAcademicCap, HiOutlineUserGroup, HiOutlineCalendar } from 'react-icons/hi';
import {
    calcFacultyScore, getFacultyResponseCount, getBestAndWeakestFields
} from '../../data/feedbackData';

// ─── Existing report types ────────────────────────────────────────────────────
const reportTypes = [
    {
        title: 'Department Report',
        desc: 'Comprehensive department-wise performance, attendance, and faculty data',
        icon: HiOutlineDocumentReport,
        color: '#1A3C6E',
        bg: 'rgba(26,60,110,0.06)',
    },
    {
        title: 'Semester Report',
        desc: 'Semester-wise academic results, statistics, and comparisons',
        icon: HiOutlineCalendar,
        color: '#2E7D32',
        bg: 'rgba(46,125,50,0.06)',
    },
    {
        title: 'Student Report',
        desc: 'Individual student performance, attendance records, and grades',
        icon: HiOutlineAcademicCap,
        color: '#6A1B9A',
        bg: 'rgba(106,27,154,0.06)',
    },
    {
        title: 'Faculty Report',
        desc: 'Faculty workload, leave records, and class performance overview',
        icon: HiOutlineUserGroup,
        color: '#1565C0',
        bg: 'rgba(21,101,192,0.06)',
    },
];

// ─── Helper: score badge ──────────────────────────────────────────────────────
function getBadge(score) {
    if (score >= 3.5) return { label: '⭐ Excellent',          bg: 'rgba(22,163,74,0.12)', color: '#15803D' };
    if (score >= 2.5) return { label: '✓ Good',                bg: 'rgba(21,101,192,0.12)', color: '#1565C0' };
    if (score >= 1.5) return { label: '~ Average',             bg: 'rgba(234,179,8,0.12)',  color: '#B45309' };
    return               { label: '⚠ Needs Improvement',      bg: 'rgba(220,38,38,0.1)',   color: '#DC2626' };
}

// ─── Faculty Ranking Table (shared: HOD & Principal) ─────────────────────────
function FacultyRankingTable({ cycle }) {
    const facultyInCycle = cycle.facultyDetails || [];
    const ranked = facultyInCycle.map(fac => {
        const rat = cycle.ratings[fac.id] || {};
        const score = calcFacultyScore(rat, cycle.fields);
        const responses = getFacultyResponseCount(rat, cycle.fields);
        const { best, weakest } = getBestAndWeakestFields(rat, cycle.fields);
        return { ...fac, score, responses, best, weakest };
    }).sort((a, b) => b.score - a.score);

    return (
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
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
    );
}

// ─── Feedback Reports Tab (Principal) ────────────────────────────────────────
function FeedbackReportsTab() {
    const [toast, setToast] = useState(null);
    const [expandedDept, setExpandedDept] = useState(null);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    // Read from localStorage instead of FEEDBACK_CYCLES
    const LS_KEY = 'vignan_hod_feedback_cycle_cse';
    let activeCyclesData = [];
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            activeCyclesData = (Array.isArray(parsed) ? parsed : [parsed]).filter(c => c.status !== 'draft');
        }
    } catch {}

    // Build dept-level summary from activeCyclesData
    const deptSummaries = activeCyclesData.map(cycle => {
        const submitted = cycle.submittedBy?.length || 0;
        const total = cycle.totalStudents || 0;
        const responseRate = total > 0 ? Math.round((submitted / total) * 100) : 0;

        const facultyInCycle = cycle.facultyDetails || [];
        const facultyScores = facultyInCycle.map(fac => {
            const rat = cycle.ratings[fac.id] || {};
            return { fac, score: calcFacultyScore(rat, cycle.fields) };
        });
        const deptAvg = facultyScores.length
            ? (facultyScores.reduce((s, f) => s + f.score, 0) / facultyScores.length).toFixed(1)
            : '0.0';
        const bestFac = facultyScores.sort((a, b) => b.score - a.score)[0];
        const needsAttention = facultyScores.filter(f => f.score < 2.5).map(f => f.fac.name);

        return { cycle, submitted, total, responseRate, deptAvg, bestFac, needsAttention };
    });

    // Institution-wide stats
    const totalResponses = deptSummaries.reduce((s, d) => s + d.submitted, 0);
    const totalStudents  = deptSummaries.reduce((s, d) => s + d.total, 0);
    const instAvg = deptSummaries.length
        ? (deptSummaries.reduce((s, d) => s + parseFloat(d.deptAvg), 0) / deptSummaries.length).toFixed(1)
        : '0.0';
    const activeCycles = deptSummaries.filter(d => d.cycle.status === 'active').length;
    const lowResponseDepts = deptSummaries.filter(d => d.responseRate < 50).length;
    const overallRate = totalStudents > 0 ? Math.round((totalResponses / totalStudents) * 100) : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
                    background: '#15803D', color: 'white', padding: '14px 22px',
                    borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                    fontSize: '0.875rem', fontWeight: 600, animation: 'fadeIn 0.3s ease',
                }}>{toast}</div>
            )}

            {/* Export + Stats row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                {/* Institution-wide stats */}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {[
                        { label: 'Total Responses',  value: totalResponses, color: '#1A3C6E', bg: 'rgba(26,60,110,0.06)' },
                        { label: 'Inst. Avg Score',  value: instAvg + ' / 4.0', color: '#6A1B9A', bg: 'rgba(106,27,154,0.06)' },
                        { label: 'Active Cycles',    value: activeCycles, color: '#15803D', bg: 'rgba(22,163,74,0.06)' },
                        {
                            label: 'Low Response Depts',
                            value: lowResponseDepts,
                            color: lowResponseDepts > 0 ? '#DC2626' : '#15803D',
                            bg: lowResponseDepts > 0 ? 'rgba(220,38,38,0.07)' : 'rgba(22,163,74,0.06)',
                        },
                    ].map(stat => (
                        <div key={stat.label} style={{
                            padding: '14px 18px', borderRadius: 12,
                            background: stat.bg, minWidth: 130, textAlign: 'center',
                        }}>
                            <p style={{ fontSize: '1.4rem', fontWeight: 900, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4 }}>{stat.label}</p>
                        </div>
                    ))}
                </div>
                {/* Export */}
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => showToast('📊 Institution feedback report exported as Excel')}>📊 Excel</button>
                    <button className="btn btn-principal btn-sm" onClick={() => showToast('📄 Institution feedback report exported as PDF')}>📄 Export Full Report</button>
                </div>
            </div>

            {/* Dept-wise table */}
            <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                    Department-wise Feedback Summary
                </h3>
                {deptSummaries.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                        <p style={{ fontSize: '2rem', marginBottom: 10 }}>📭</p>
                        <p style={{ fontWeight: 600 }}>No feedback cycles available.</p>
                        <p style={{ fontSize: '0.85rem', marginTop: 4 }}>HODs need to publish feedback forms first.</p>
                    </div>
                )}
                {deptSummaries.map(({ cycle, submitted, total, responseRate, deptAvg, bestFac, needsAttention }) => (
                    <div key={cycle.id} style={{ marginBottom: 12 }}>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: '80px 1fr 100px 100px 1fr auto auto',
                            gap: 16, alignItems: 'center',
                            padding: '14px 18px', borderRadius: 10,
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        }}>
                            <span style={{ fontWeight: 800, fontSize: '0.875rem', color: '#1A3C6E' }}>{cycle.dept}</span>
                            <div>
                                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{cycle.title}</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{
                                    fontWeight: 700, fontSize: '0.95rem',
                                    color: responseRate >= 75 ? '#15803D' : responseRate >= 50 ? '#B45309' : '#DC2626',
                                }}>{responseRate}%</p>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Response Rate</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#6A1B9A' }}>{deptAvg}</p>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Dept Avg</p>
                            </div>
                            <div>
                                {bestFac && (
                                    <>
                                        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#15803D' }}>⭐ {bestFac.fac.name}</p>
                                        <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>Score: {bestFac.score.toFixed(1)}</p>
                                    </>
                                )}
                                {needsAttention.length > 0 && (
                                    <p style={{ fontSize: '0.68rem', color: '#DC2626', marginTop: 2 }}>⚠ {needsAttention.join(', ')}</p>
                                )}
                            </div>
                            <span style={{
                                padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 700,
                                background: cycle.status === 'active' ? 'rgba(22,163,74,0.12)' : cycle.status === 'draft' ? 'rgba(234,179,8,0.12)' : 'rgba(220,38,38,0.1)',
                                color: cycle.status === 'active' ? '#15803D' : cycle.status === 'draft' ? '#B45309' : '#DC2626',
                                whiteSpace: 'nowrap',
                            }}>{cycle.status.toUpperCase()}</span>
                            <button
                                onClick={() => setExpandedDept(expandedDept === cycle.id ? null : cycle.id)}
                                className="btn btn-outline btn-sm"
                                style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}
                            >
                                {expandedDept === cycle.id ? 'Hide ▲' : 'View Details ▼'}
                            </button>
                        </div>

                        {/* Expanded faculty ranking */}
                        {expandedDept === cycle.id && (
                            <div style={{
                                marginTop: 4, padding: '20px', borderRadius: '0 0 10px 10px',
                                border: '1px solid var(--border)', borderTop: 'none',
                                background: 'var(--bg-card)', animation: 'fadeIn 0.2s ease',
                            }}>
                                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                    Faculty Ranking — {cycle.dept}
                                </p>
                                <FacultyRankingTable cycle={cycle} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Main Reports Page ────────────────────────────────────────────────────────
export default function Reports() {
    const [activeTab, setActiveTab] = useState('reports');

    const tabs = [
        { id: 'reports',  label: '📄 Reports' },
        { id: 'feedback', label: '📋 Feedback Reports' },
    ];

    return (
        <DashboardLayout>
            {/* Page Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                    Reports
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Generate institutional reports and view feedback analytics
                </p>
            </div>

            {/* Tab Toggle */}
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
                            color: activeTab === t.id ? 'var(--principal)' : 'var(--text-secondary)',
                            boxShadow: activeTab === t.id ? 'var(--shadow-sm)' : 'none',
                        }}
                    >{t.label}</button>
                ))}
            </div>

            {/* Reports Tab (existing) */}
            {activeTab === 'reports' && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 16,
                }}>
                    {reportTypes.map((report, i) => (
                        <div key={i} style={{
                            borderRadius: 14, overflow: 'hidden',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                        }}
                            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                            <div style={{ height: 3, background: report.color }} />
                            <div style={{ padding: '22px 20px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: report.bg, color: report.color, flexShrink: 0,
                                    }}>
                                        <report.icon size={22} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
                                            {report.title}
                                        </h3>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                                            {report.desc}
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-sm" style={{
                                        background: report.color, color: 'white',
                                        padding: '7px 16px', borderRadius: 8,
                                        fontSize: '0.78rem', fontWeight: 600,
                                        border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                    }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                        📄 PDF
                                    </button>
                                    <button className="btn btn-sm" style={{
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        padding: '7px 16px', borderRadius: 8,
                                        fontSize: '0.78rem', fontWeight: 600,
                                        border: '1px solid var(--border)',
                                        cursor: 'pointer', transition: 'all 0.15s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = report.color; e.currentTarget.style.color = report.color; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}>
                                        📊 Excel
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Feedback Reports Tab */}
            {activeTab === 'feedback' && <FeedbackReportsTab />}
        </DashboardLayout>
    );
}
