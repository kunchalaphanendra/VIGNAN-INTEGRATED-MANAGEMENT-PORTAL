import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import StatCard from '../../components/StatCard';
import DataTable from '../../components/DataTable';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../utils/api';
import { HiOutlineUserGroup, HiOutlineAcademicCap, HiOutlineExclamation, HiOutlineClock, HiOutlineSearch } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';

const medals = ['🥇', '🥈', '🥉'];

function getStatusBadge(cgpa, att, backlogs, topPct) {
    if (topPct) return { label: 'Top Performer', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' };
    if ((cgpa !== null && cgpa < 6) || (att !== null && att < 75) || backlogs > 0) return { label: 'Needs Attention', color: '#DC2626', bg: 'rgba(220,38,38,0.1)' };
    return { label: 'Average', color: '#D97706', bg: 'rgba(217,119,6,0.1)' };
}

export default function HodDashboard() {
    const [data, setData] = useState(null);
    const [students, setStudents] = useState([]);
    const [statsMap, setStatsMap] = useState({ attMap: {}, cgpaMap: {}, sgpaMap: {}, backlogMap: {} });
    const [loading, setLoading] = useState(true);
    const [prioritySearch, setPrioritySearch] = useState('');
    const navigate = useNavigate();

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [dashRes, studRes, statsRes] = await Promise.all([
                api.get('/hod/dashboard'),
                api.get('/hod/students'),
                api.get('/hod/students/stats'),
            ]);
            setData(dashRes.data);
            setStudents(studRes.data.students || []);
            setStatsMap(statsRes.data || { attMap: {}, cgpaMap: {}, sgpaMap: {}, backlogMap: {} });
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    /* Build and sort priority list using real data */
    const priorityList = useMemo(() => {
        const { attMap, cgpaMap, sgpaMap, backlogMap } = statsMap;
        const enriched = students.map(s => ({
            ...s,
            cgpa: cgpaMap[s.id] ?? null,
            sgpa: sgpaMap?.[s.id] ?? null,
            att: attMap[s.id]?.percentage ?? null,
            backlogs: backlogMap[s.id] ?? 0,
        }));
        // Sort: students with CGPA first (highest first), then those without
        enriched.sort((a, b) => {
            const cA = a.cgpa ?? -1;
            const cB = b.cgpa ?? -1;
            return cB !== cA ? cB - cA : (b.att ?? -1) - (a.att ?? -1);
        });
        const top10Idx = Math.max(1, Math.ceil(enriched.filter(s => s.cgpa !== null).length * 0.1));
        return enriched.map((s, idx) => ({ ...s, rank: idx + 1, isTop: idx < top10Idx && s.cgpa !== null }));
    }, [students, statsMap]);

    const filteredList = useMemo(() => {
        const q = prioritySearch.trim().toLowerCase();
        if (!q) return priorityList;
        return priorityList.filter(s =>
            (s.full_name || '').toLowerCase().includes(q) ||
            (s.roll_number || '').toLowerCase().includes(q)
        );
    }, [priorityList, prioritySearch]);

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    const defaulterCols = [
        { key: 'name', header: 'Student', accessor: 'full_name' },
        { key: 'roll', header: 'Roll No', accessor: 'roll_number' },
        { key: 'subject', header: 'Subject', accessor: 'subject_name' },
        {
            key: 'pct', header: 'Attendance', accessor: 'percentage', render: row => (
                <span style={{ fontWeight: 600, color: row.percentage < 60 ? '#DC2626' : '#F59E0B' }}>{row.percentage}%</span>
            )
        }
    ];

    const quickActions = [
        { label: '+ Add Faculty', path: '/hod/faculty', primary: true },
        { label: '+ Add Student', path: '/hod/students', primary: true },
        { label: 'Assign Classes', path: '/hod/assignments', primary: false },
        { label: 'View Reports', path: '/hod/attendance', primary: false },
    ];

    return (
        <DashboardLayout>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>HOD Dashboard</h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>Department overview and management</p>
            </div>

            <div className="stat-grid-4" style={{ display: 'grid', gap: 16, marginBottom: 28 }}>
                <StatCard icon={HiOutlineUserGroup} label="Total Faculty" value={data?.total_faculty} color="#1565C0" />
                <StatCard icon={HiOutlineAcademicCap} label="Total Students" value={data?.total_students} color="#6A1B9A" />
                <StatCard icon={HiOutlineExclamation} label="Defaulters" value={data?.defaulters?.length || 0} color="#DC2626" />
                <StatCard icon={HiOutlineClock} label="Pending Leaves" value={data?.pending_leaves || 0} color="#E8A020" />
            </div>

            {/* Quick actions */}
            <div className="stat-grid-4" style={{ display: 'grid', gap: 12, marginBottom: 28 }}>
                {quickActions.map((a, i) => (
                    <button key={i} onClick={() => navigate(a.path)}
                        style={{
                            width: '100%', padding: '12px 16px', borderRadius: 12,
                            fontSize: '0.835rem', fontWeight: 600,
                            background: a.primary ? 'linear-gradient(135deg, #2E7D32, #4CAF50)' : 'var(--bg-card)',
                            border: a.primary ? 'none' : '1px solid var(--border)',
                            color: a.primary ? 'white' : 'var(--text-primary)',
                            boxShadow: a.primary ? '0 2px 8px rgba(46,125,50,0.25)' : 'var(--shadow-sm)',
                            cursor: 'pointer', transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                    >{a.label}</button>
                ))}
            </div>

            {/* Defaulters */}
            {data?.defaulters?.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <HiOutlineExclamation style={{ color: '#DC2626' }} /> Attendance Alerts
                    </h2>
                    <DataTable columns={defaulterCols} data={data.defaulters} searchable={false} />
                </div>
            )}

            {/* ── Feature 4: Academic Priority List ────────────────────────────────── */}
            <div style={{
                borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
            }} className="hod-priority-card">
                {/* Card header */}
                <div className="hod-priority-header" style={{
                    padding: '18px 22px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
                }}>
                    <div>
                        <h2 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            🏆 Academic Priority List
                        </h2>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                            Students ranked by CGPA — top to bottom
                        </p>
                    </div>
                    <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: 240 }}>
                        <HiOutlineSearch size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input
                            type="text"
                            placeholder="Search name or roll..."
                            value={prioritySearch}
                            onChange={e => setPrioritySearch(e.target.value)}
                            style={{
                                paddingLeft: 32, paddingRight: 12, height: 36, borderRadius: 8,
                                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                fontSize: '0.8rem', color: 'var(--text-primary)', outline: 'none',
                                width: '100%', boxSizing: 'border-box',
                            }}
                        />
                    </div>
                </div>

                {/* Priority table */}
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 480, WebkitOverflowScrolling: 'touch' }}>
                    <table className="data-table" style={{ margin: 0 }}>
                        <thead>
                            <tr>
                                <th style={{ width: 52 }}>Rank</th>
                                <th>Student</th>
                                <th>CGPA</th>
                                <th>SGPA</th>
                                <th>Attendance</th>
                                <th>Backlogs</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredList.length === 0 && (
                                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>No students found</td></tr>
                            )}
                            {filteredList.map((s) => {
                                const badge = getStatusBadge(s.cgpa, s.att, s.backlogs, s.isTop);
                                const attColor = s.att === null ? 'var(--text-tertiary)' : s.att >= 85 ? '#16A34A' : s.att >= 75 ? '#F59E0B' : '#DC2626';
                                return (
                                    <tr key={s.id}>
                                        <td style={{ textAlign: 'center' }}>
                                            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                                {s.rank <= 3 ? medals[s.rank - 1] : `#${s.rank}`}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{s.full_name}</div>
                                            <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 1 }}>{s.roll_number}</div>
                                        </td>
                                        <td>
                                            {s.cgpa !== null
                                                ? <span style={{ fontWeight: 800, fontSize: '1rem', color: s.cgpa >= 8 ? '#16A34A' : s.cgpa >= 6 ? '#D97706' : '#DC2626' }}>{Number(s.cgpa).toFixed(2)}</span>
                                                : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>
                                            }
                                        </td>
                                        <td>
                                            {s.sgpa !== null
                                                ? <span style={{ fontWeight: 700, fontSize: '0.9rem', color: s.sgpa >= 8 ? '#16A34A' : s.sgpa >= 6 ? '#D97706' : '#DC2626' }}>{Number(s.sgpa).toFixed(2)}</span>
                                                : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>
                                            }
                                        </td>
                                        <td>
                                            {s.att !== null
                                                ? <span style={{ fontWeight: 700, color: attColor }}>{s.att}%</span>
                                                : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>
                                            }
                                        </td>
                                        <td>
                                            {s.backlogs > 0
                                                ? <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>⚠ {s.backlogs}</span>
                                                : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>
                                            }
                                        </td>
                                        <td>
                                            <span style={{
                                                padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 700,
                                                background: badge.bg, color: badge.color,
                                            }}>{badge.label}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}
