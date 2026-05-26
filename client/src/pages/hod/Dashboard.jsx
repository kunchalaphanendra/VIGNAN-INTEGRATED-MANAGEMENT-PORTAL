import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import StatCard from '../../components/StatCard';
import DataTable from '../../components/DataTable';
import { SkeletonGrid, SkeletonTable } from '../../components/SkeletonCard';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { HiOutlineUserGroup, HiOutlineAcademicCap, HiOutlineExclamation, HiOutlineClock, HiOutlineSearch } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';

const medals = ['🥇', '🥈', '🥉'];

function getStatusBadge(cgpa, att, backlogs, topPct) {
    if (topPct) return { label: 'Top Performer', color: '#16A34A', bg: 'rgba(22,163,74,0.12)' };
    if ((cgpa !== null && cgpa < 6) || (att !== null && att < 75) || backlogs > 0) return { label: 'Needs Attention', color: '#DC2626', bg: 'rgba(220,38,38,0.1)' };
    return { label: 'Average', color: '#D97706', bg: 'rgba(217,119,6,0.1)' };
}

export default function HodDashboard() {
    const { user } = useAuth();
    const [data, setData] = useState(null);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const navigate = useNavigate();

    // Filters and Search state
    const [selectedYear, setSelectedYear] = useState('all');
    const [selectedSection, setSelectedSection] = useState('all');
    const [selectedSortBy, setSelectedSortBy] = useState('cgpa');
    const [prioritySearch, setPrioritySearch] = useState('');

    // Debounced filtering data fetch
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchFilteredData();
        }, 300);

        return () => clearTimeout(timer);
    }, [selectedYear, selectedSection, selectedSortBy, prioritySearch]);

    const fetchFilteredData = async () => {
        setIsTransitioning(true);
        try {
            const [dashRes, plRes] = await Promise.all([
                api.get('/hod/dashboard', {
                    params: {
                        year: selectedYear !== 'all' ? selectedYear : undefined,
                        section: selectedSection !== 'all' ? selectedSection : undefined,
                    }
                }),
                api.get('/hod/priority-list', {
                    params: {
                        year: selectedYear !== 'all' ? selectedYear : undefined,
                        section: selectedSection !== 'all' ? selectedSection : undefined,
                        sortBy: selectedSortBy,
                        search: prioritySearch.trim() || undefined,
                    }
                })
            ]);
            setData(dashRes.data);
            setStudents(plRes.data.students || []);
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
        } finally {
            setLoading(false);
            setIsTransitioning(false);
        }
    };

    // Calculate rank and isTop (top 10% by CGPA)
    const priorityList = useMemo(() => {
        // Find threshold CGPA for top 10%
        const cgpas = students.map(s => s.cgpa).filter(c => c !== null).sort((a, b) => b - a);
        const top10Count = Math.max(1, Math.ceil(cgpas.length * 0.1));
        const thresholdCgpa = cgpas.length > 0 ? cgpas[top10Count - 1] : 10;

        return students.map((s, idx) => ({
            ...s,
            rank: idx + 1,
            isTop: s.cgpa !== null && s.cgpa >= thresholdCgpa
        }));
    }, [students]);

    const sortByLabel = useMemo(() => {
        switch (selectedSortBy) {
            case 'sgpa': return 'SGPA';
            case 'attendance': return 'Attendance %';
            case 'lowest_attendance': return 'Lowest Attendance';
            case 'least_backlogs': return 'Least Backlogs';
            case 'most_backlogs': return 'Most Backlogs';
            case 'marks_avg': return 'Marks Average';
            case 'cgpa':
            default: return 'CGPA';
        }
    }, [selectedSortBy]);

    const dynamicTitle = useMemo(() => {
        let titleText = 'Academic Priority List';
        if (selectedYear !== 'all') {
            const yearsMap = { '1': '1st Year', '2': '2nd Year', '3': '3rd Year', '4': '4th Year' };
            titleText += ` – ${yearsMap[selectedYear] || selectedYear}`;
        }
        if (selectedSection !== 'all') {
            titleText += ` Section ${selectedSection}`;
        }
        if (selectedYear === 'all' && selectedSection === 'all') {
            titleText += ' – Entire Department';
        }
        return titleText;
    }, [selectedYear, selectedSection]);

    if (loading) return (
        <DashboardLayout>
            <div style={{ marginBottom: 24 }}><SkeletonGrid count={4} /></div>
            <div style={{ marginBottom: 24 }}><SkeletonTable rows={4} cols={4} /></div>
        </DashboardLayout>
    );

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

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    return (
        <DashboardLayout>
            <div className="page-header-row">
                <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: 4 }}>
                        {greeting} 👋
                    </p>
                    <h1 style={{ margin: 0 }}>{user?.full_name || 'HOD'}</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, textTransform: 'capitalize' }}>
                        HOD - {user?.department_name || 'Department overview'}
                    </p>
                </div>
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
                transition: 'opacity 0.25s ease',
                opacity: isTransitioning ? 0.6 : 1,
                pointerEvents: isTransitioning ? 'none' : 'auto'
            }} className="hod-priority-card">
                
                {/* Card header containing Filter System */}
                <div className="hod-priority-header" style={{
                    padding: '20px 24px', 
                    borderBottom: '1px solid var(--border)',
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 16
                }}>
                    {/* Row 1: Title & Search */}
                    <div style={{
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        flexWrap: 'wrap', 
                        gap: 12
                    }}>
                        <div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                {dynamicTitle}
                            </h2>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                                Ranked by {sortByLabel} — top to bottom
                            </p>
                        </div>
                        
                        {/* Search Input */}
                        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
                            <HiOutlineSearch size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                            <input
                                type="text"
                                placeholder="Search name or roll..."
                                value={prioritySearch}
                                onChange={e => setPrioritySearch(e.target.value)}
                                style={{
                                    paddingLeft: 32, paddingRight: 12, height: 38, borderRadius: 10,
                                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', outline: 'none',
                                    width: '100%', boxSizing: 'border-box',
                                    transition: 'all 0.2s ease',
                                }}
                            />
                        </div>
                    </div>

                    {/* Row 2: Select Filters */}
                    <div style={{
                        display: 'flex', 
                        alignItems: 'center', 
                        flexWrap: 'wrap', 
                        gap: 16,
                        paddingTop: 12,
                        borderTop: '1px dashed var(--border)'
                    }}>
                        {/* Year Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Year</span>
                            <select
                                value={selectedYear}
                                onChange={e => setSelectedYear(e.target.value)}
                                style={{
                                    height: 38, padding: '0 12px', borderRadius: 8,
                                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', outline: 'none',
                                    cursor: 'pointer', minWidth: 150, transition: 'all 0.2s ease'
                                }}
                            >
                                <option value="all">Entire Department</option>
                                <option value="1">1st Year</option>
                                <option value="2">2nd Year</option>
                                <option value="3">3rd Year</option>
                                <option value="4">4th Year</option>
                            </select>
                        </div>

                        {/* Section Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Section</span>
                            <select
                                value={selectedSection}
                                onChange={e => setSelectedSection(e.target.value)}
                                style={{
                                    height: 38, padding: '0 12px', borderRadius: 8,
                                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', outline: 'none',
                                    cursor: 'pointer', minWidth: 120, transition: 'all 0.2s ease'
                                }}
                            >
                                <option value="all">All Sections</option>
                                {['A', 'B', 'C', 'D'].map(sec => (
                                    <option key={sec} value={sec}>{sec}</option>
                                ))}
                            </select>
                        </div>

                        {/* Sorting Filter */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, maxWidth: 240 }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sort / Rank By</span>
                            <select
                                value={selectedSortBy}
                                onChange={e => setSelectedSortBy(e.target.value)}
                                style={{
                                    height: 38, padding: '0 12px', borderRadius: 8,
                                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                                    fontSize: '0.8rem', color: 'var(--text-primary)', outline: 'none',
                                    cursor: 'pointer', width: '100%', transition: 'all 0.2s ease'
                                }}
                            >
                                <option value="cgpa">CGPA (Highest first)</option>
                                <option value="sgpa">SGPA (Highest first)</option>
                                <option value="attendance">Attendance % (Highest first)</option>
                                <option value="least_backlogs">Least Backlogs (Lowest first)</option>
                                <option value="most_backlogs">Most Backlogs (Highest first)</option>
                                <option value="marks_avg">Highest Marks Average</option>
                                <option value="lowest_attendance">Lowest Attendance (Lowest first)</option>
                            </select>
                        </div>

                        {/* Reset Button */}
                        {(selectedYear !== 'all' || selectedSection !== 'all' || selectedSortBy !== 'cgpa' || prioritySearch) && (
                            <button
                                onClick={() => {
                                    setSelectedYear('all');
                                    setSelectedSection('all');
                                    setSelectedSortBy('cgpa');
                                    setPrioritySearch('');
                                }}
                                style={{
                                    alignSelf: 'flex-end',
                                    height: 38, padding: '0 16px', borderRadius: 8,
                                    border: '1px solid var(--border)', background: 'var(--bg-card)',
                                    fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.2s ease'
                                }}
                            >
                                Reset Filters
                            </button>
                        )}
                    </div>
                </div>

                {/* Priority table */}
                <div className="card-table-wrap" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 480, WebkitOverflowScrolling: 'touch' }}>
                    <table className="data-table" style={{ margin: 0 }}>
                        <thead>
                            <tr>
                                <th style={{ width: 52 }}>Rank</th>
                                <th>Student</th>
                                <th>CGPA</th>
                                <th>SGPA</th>
                                <th>Attendance</th>
                                <th>Avg Marks</th>
                                <th>Backlogs</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {priorityList.length === 0 && (
                                <tr>
                                    <td colSpan={8} data-label="" style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>
                                        No students found for selected filters
                                    </td>
                                </tr>
                            )}
                            {priorityList.map((s) => {
                                const badge = getStatusBadge(s.cgpa, s.att, s.backlogs, s.isTop);
                                const attColor = s.att === null ? 'var(--text-tertiary)' : s.att >= 85 ? '#16A34A' : s.att >= 75 ? '#F59E0B' : '#DC2626';
                                return (
                                    <tr key={s.id}>
                                        <td data-label="Rank" style={{ textAlign: 'center' }}>
                                            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                                {s.rank <= 3 ? medals[s.rank - 1] : `#${s.rank}`}
                                            </span>
                                        </td>
                                        <td data-label="Student">
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{s.full_name}</div>
                                            <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 1 }}>{s.roll_number}</div>
                                        </td>
                                        <td data-label="CGPA">
                                            {s.cgpa !== null
                                                ? <span style={{ fontWeight: 800, fontSize: '1rem', color: s.cgpa >= 8 ? '#16A34A' : s.cgpa >= 6 ? '#D97706' : '#DC2626' }}>{Number(s.cgpa).toFixed(2)}</span>
                                                : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>
                                            }
                                        </td>
                                        <td data-label="SGPA">
                                            {s.sgpa !== null
                                                ? <span style={{ fontWeight: 700, fontSize: '0.9rem', color: s.sgpa >= 8 ? '#16A34A' : s.sgpa >= 6 ? '#D97706' : '#DC2626' }}>{Number(s.sgpa).toFixed(2)}</span>
                                                : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>
                                            }
                                        </td>
                                        <td data-label="Attendance">
                                            {s.att !== null
                                                ? <span style={{ fontWeight: 700, color: attColor }}>{s.att}%</span>
                                                : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>
                                            }
                                        </td>
                                        <td data-label="Avg Marks">
                                            {s.marks_average !== null
                                                ? <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Number(s.marks_average).toFixed(1)}</span>
                                                : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>
                                            }
                                        </td>
                                        <td data-label="Backlogs">
                                            {s.backlogs > 0
                                                ? <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>⚠ {s.backlogs}</span>
                                                : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>
                                            }
                                        </td>
                                        <td data-label="Status">
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
