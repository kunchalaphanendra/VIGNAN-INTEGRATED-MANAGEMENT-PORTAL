import { useState, useEffect, useRef, useMemo } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
    HiOutlineUpload, HiOutlineDownload, HiOutlineCheckCircle,
    HiOutlineExclamationCircle, HiOutlineX, HiOutlinePencilAlt,
    HiOutlineChatAlt2, HiOutlineEye, HiOutlineSearch,
    HiOutlineFilter, HiOutlineAcademicCap, HiOutlineClipboardList,
    HiOutlineChartBar, HiOutlineUser, HiOutlinePhone,
    HiOutlineMail, HiOutlineCalendar, HiOutlineLocationMarker,
} from 'react-icons/hi';
import api from '../../utils/api';

// ── Template CSV content ─────────────────────────────────────────────────────
const TEMPLATE_HEADERS = 'roll_number,full_name,email,phone,year,semester,section,password';
const TEMPLATE_SAMPLE  = '24891A6701,Ravi Kumar,ravi@example.com,9876543210,2,4,B,Pass@1234';

function downloadTemplate() {
    const blob = new Blob([TEMPLATE_HEADERS + '\n' + TEMPLATE_SAMPLE], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'student_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
}

// ── Colour helpers ────────────────────────────────────────────────────────────
const gpaColor  = v => v == null ? 'var(--text-tertiary)' : v >= 8 ? '#15803D' : v >= 6 ? '#D97706' : '#DC2626';
const attColor  = v => v == null ? 'var(--text-tertiary)' : v >= 85 ? '#15803D' : v >= 75 ? '#D97706' : '#DC2626';
const examLabel = l => {
    if (!l) return '';
    const m = l.match(/mid[_-]?(\d)/i) || l.match(/(\d)/);
    if (/mid/i.test(l)) return `MID ${m ? m[1] : ''}`.trim();
    if (/internal/i.test(l)) return 'Internal';
    if (/assignment/i.test(l)) return 'Assignment';
    return l;
};

// ── Student Full-Data Modal ───────────────────────────────────────────────────
function StudentDataModal({ student, onClose }) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab]         = useState('marks');

    useEffect(() => {
        if (!student) return;
        setLoading(true);
        setData(null);
        api.get(`/hod/students/${student.id}/full`)
            .then(r => setData(r.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [student]);

    // ── Group marks by subject — must be BEFORE any early return (Rules of Hooks) ──
    const subjectMarks = useMemo(() => {
        if (!data?.marks) return {};
        const map = {};
        data.marks.forEach(m => {
            const key = m.subject_code || m.subject_name;
            if (!map[key]) map[key] = { name: m.subject_name, code: m.subject_code, credits: m.credits, exams: [] };
            map[key].exams.push(m);
        });
        return map;
    }, [data]);

    if (!student) return null;

    const tabs = [
        { id: 'marks',      label: 'Marks & Exams',  icon: HiOutlineClipboardList },
        { id: 'attendance', label: 'Attendance',      icon: HiOutlineChartBar      },
        { id: 'grades',     label: 'Grades & GPA',   icon: HiOutlineAcademicCap   },
        { id: 'profile',    label: 'Profile',         icon: HiOutlineUser          },
    ];

    return (
        <Modal isOpen={!!student} onClose={onClose} title="" size="xl">
            {/* ── Header ── */}
            <div style={{
                background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)',
                margin: '-24px -24px 0', padding: '24px 28px 20px',
                borderRadius: '12px 12px 0 0', color: '#fff',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem', fontWeight: 800, color: '#fff',
                        border: '2px solid rgba(255,255,255,0.3)',
                    }}>
                        {student.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{student.full_name}</h2>
                        <p style={{ margin: '3px 0 0', opacity: 0.85, fontSize: '0.82rem', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                            <span>📋 {student.roll_number}</span>
                            <span>📅 Year {student.year} · Sem {student.semester}</span>
                            <span>🏷 Section {student.section}</span>
                            {data && (
                                <>
                                    {data.cgpa != null && <span>⭐ CGPA {Number(data.cgpa).toFixed(2)}</span>}
                                    {data.overall_attendance != null && <span>📊 {data.overall_attendance}% Attendance</span>}
                                </>
                            )}
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, marginTop: 18 }}>
                    {tabs.map(t => {
                        const Icon = t.icon;
                        return (
                            <button key={t.id} onClick={() => setTab(t.id)} style={{
                                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                fontSize: '0.78rem', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: tab === t.id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                                color: '#fff',
                                transition: 'background 0.15s',
                            }}>
                                <Icon size={13} /> {t.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Body ── */}
            <div style={{ padding: '20px 4px 0', minHeight: 320, maxHeight: '60vh', overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                        <LoadingSpinner />
                    </div>
                ) : !data ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: 40 }}>Failed to load student data.</p>
                ) : (
                    <>
                        {/* ── MARKS TAB ── */}
                        {tab === 'marks' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {Object.keys(subjectMarks).length === 0 ? (
                                    <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 32 }}>No marks recorded yet.</p>
                                ) : Object.entries(subjectMarks).map(([code, subj]) => (
                                    <div key={code} style={{
                                        background: 'var(--bg-secondary)', borderRadius: 12,
                                        border: '1px solid var(--border)', overflow: 'hidden',
                                    }}>
                                        {/* Subject header */}
                                        <div style={{
                                            padding: '10px 16px', background: 'var(--bg-tertiary, rgba(0,0,0,0.03))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            borderBottom: '1px solid var(--border)',
                                        }}>
                                            <div>
                                                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{subj.name}</span>
                                                <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginLeft: 8 }}>({subj.code})</span>
                                            </div>
                                            {subj.credits && (
                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                                                    {subj.credits} Credits
                                                </span>
                                            )}
                                        </div>

                                        {/* Exam rows */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 0 }}>
                                            {subj.exams.map((ex, i) => {
                                                const pct = ex.max_marks > 0 ? Math.round(ex.marks_obtained * 1000 / ex.max_marks) / 10 : null;
                                                const color = pct == null ? '#888' : pct >= 70 ? '#15803D' : pct >= 50 ? '#D97706' : '#DC2626';
                                                return (
                                                    <div key={ex.id || i} style={{
                                                        padding: '10px 16px',
                                                        borderRight: '1px solid var(--border)',
                                                        borderBottom: '1px solid var(--border)',
                                                    }}>
                                                        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                                                            {examLabel(ex.exam_label) || ex.exam_type}
                                                        </p>
                                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                                                            <span style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{ex.marks_obtained ?? '—'}</span>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>/ {ex.max_marks}</span>
                                                        </div>
                                                        {pct != null && (
                                                            <div style={{ marginTop: 6 }}>
                                                                <div style={{ height: 4, borderRadius: 2, background: 'var(--border)' }}>
                                                                    <div style={{ height: 4, borderRadius: 2, background: color, width: `${Math.min(pct, 100)}%`, transition: 'width 0.5s' }} />
                                                                </div>
                                                                <span style={{ fontSize: '0.68rem', color, fontWeight: 600 }}>{pct}%</span>
                                                            </div>
                                                        )}
                                                        <div style={{ marginTop: 5, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                            {ex.is_published ? (
                                                                <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: 4, background: 'rgba(22,163,74,0.1)', color: '#15803D', fontWeight: 600 }}>Published</span>
                                                            ) : (
                                                                <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: 4, background: 'rgba(234,179,8,0.1)', color: '#b45309', fontWeight: 600 }}>Draft</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── ATTENDANCE TAB ── */}
                        {tab === 'attendance' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {/* Overall card */}
                                <div style={{
                                    padding: '16px 20px', borderRadius: 12,
                                    background: 'linear-gradient(135deg, #1e40af10, #7c3aed10)',
                                    border: '1px solid var(--border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                }}>
                                    <div>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall Attendance</p>
                                        <p style={{ fontSize: '2rem', fontWeight: 900, color: attColor(data.overall_attendance), margin: '4px 0 0' }}>
                                            {data.overall_attendance != null ? `${data.overall_attendance}%` : '—'}
                                        </p>
                                    </div>
                                    <div style={{
                                        width: 64, height: 64, borderRadius: '50%',
                                        background: `conic-gradient(${attColor(data.overall_attendance)} ${(data.overall_attendance || 0) * 3.6}deg, var(--border) 0deg)`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-primary, white)' }} />
                                    </div>
                                </div>

                                {data.attendance.length === 0 ? (
                                    <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 24 }}>No attendance data available.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {data.attendance.map((a, i) => {
                                            const pct = Number(a.percentage) || 0;
                                            return (
                                                <div key={i} style={{
                                                    padding: '12px 16px', borderRadius: 10,
                                                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                        <div>
                                                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{a.subject_name}</span>
                                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: 8 }}>({a.subject_code})</span>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <span style={{ fontWeight: 800, fontSize: '1rem', color: attColor(pct) }}>{pct}%</span>
                                                            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{a.attended}/{a.total} classes</p>
                                                        </div>
                                                    </div>
                                                    <div style={{ height: 6, borderRadius: 3, background: 'var(--border)' }}>
                                                        <div style={{
                                                            height: 6, borderRadius: 3,
                                                            background: attColor(pct),
                                                            width: `${Math.min(pct, 100)}%`,
                                                            transition: 'width 0.6s ease',
                                                        }} />
                                                    </div>
                                                    {pct < 75 && (
                                                        <p style={{ margin: '6px 0 0', fontSize: '0.7rem', color: '#DC2626', fontWeight: 600 }}>
                                                            ⚠ Below 75% threshold
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── GRADES TAB ── */}
                        {tab === 'grades' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* CGPA / SGPA cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    {[
                                        { label: 'CGPA', value: data.cgpa, desc: 'Cumulative GPA' },
                                        { label: 'SGPA', value: data.sgpa, desc: 'Semester GPA'   },
                                    ].map(item => (
                                        <div key={item.label} style={{
                                            padding: '16px 20px', borderRadius: 12,
                                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                            textAlign: 'center',
                                        }}>
                                            <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</p>
                                            <p style={{ margin: '6px 0 0', fontSize: '2rem', fontWeight: 900, color: gpaColor(item.value) }}>
                                                {item.value != null ? Number(item.value).toFixed(2) : '—'}
                                            </p>
                                            <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{item.desc}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Backlogs */}
                                {data.backlogs.length > 0 && (
                                    <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}>
                                        <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '0.82rem', color: '#DC2626' }}>⚠ Active Backlogs ({data.backlogs.length})</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {data.backlogs.map((b, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(220,38,38,0.06)', borderRadius: 6 }}>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{b.subject_name}</span>
                                                    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 6, background: 'rgba(220,38,38,0.1)', color: '#DC2626', fontWeight: 700 }}>Sem {b.semester}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Grades table */}
                                {data.grades.length > 0 ? (
                                    <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                                    {['Subject', 'Code', 'Credits', 'Grade', 'Points'].map(h => (
                                                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.grades.map((g, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                                                        <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{g.subject_name}</td>
                                                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{g.code}</td>
                                                        <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{g.credits}</td>
                                                        <td style={{ padding: '8px 12px' }}>
                                                            <span style={{
                                                                padding: '2px 8px', borderRadius: 6, fontWeight: 800, fontSize: '0.8rem',
                                                                background: g.grade_letter === 'F' ? 'rgba(220,38,38,0.1)' : g.grade_letter === 'S' ? 'rgba(22,163,74,0.1)' : 'rgba(99,102,241,0.1)',
                                                                color: g.grade_letter === 'F' ? '#DC2626' : g.grade_letter === 'S' ? '#15803D' : '#6366f1',
                                                            }}>{g.grade_letter}</span>
                                                        </td>
                                                        <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>{g.grade_points}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 24 }}>No grade records found.</p>
                                )}
                            </div>
                        )}

                        {/* ── PROFILE TAB ── */}
                        {tab === 'profile' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                {[
                                    { icon: HiOutlineUser,            label: 'Full Name',      val: data.profile.full_name     },
                                    { icon: HiOutlineClipboardList,   label: 'Roll Number',    val: data.profile.roll_number    },
                                    { icon: HiOutlineMail,            label: 'Email',          val: data.profile.email         },
                                    { icon: HiOutlinePhone,           label: 'Phone',          val: data.profile.phone         },
                                    { icon: HiOutlineCalendar,        label: 'Date of Birth',  val: data.profile.date_of_birth ? new Date(data.profile.date_of_birth).toLocaleDateString('en-IN') : null },
                                    { icon: HiOutlineLocationMarker,  label: 'Address',        val: data.profile.address       },
                                    { icon: HiOutlineUser,            label: 'Parent / Guardian', val: data.profile.parent_name },
                                    { icon: HiOutlinePhone,           label: 'Parent Phone',   val: data.profile.parent_phone  },
                                ].map((item, i) => {
                                    const Icon = item.icon;
                                    return (
                                        <div key={i} style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                <Icon size={13} color="var(--text-secondary)" />
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.87rem', fontWeight: 600, color: item.val ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                                {item.val || '—'}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function HodStudents() {
    const [students, setStudents] = useState([]);
    const [statsMap, setStatsMap] = useState({ attMap: {}, cgpaMap: {}, sgpaMap: {}, backlogMap: {} });
    const [loading, setLoading]   = useState(true);

    // Filters
    const [filterYear,    setFilterYear]    = useState('');
    const [filterSection, setFilterSection] = useState('');
    const [search,        setSearch]        = useState('');

    // Add / Edit student modal
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editId,    setEditId]    = useState(null);
    const [form, setForm] = useState({
        full_name: '', email: '', phone: '', password: '',
        roll_number: '', year: 1, semester: 1, section: 'A',
        parent_name: '', parent_phone: '', date_of_birth: ''
    });

    // View-Data modal
    const [viewStudent, setViewStudent] = useState(null);

    // Import modal
    const [showImport,    setShowImport]    = useState(false);
    const [importFile,    setImportFile]    = useState(null);
    const [importing,     setImporting]     = useState(false);
    const [importResult,  setImportResult]  = useState(null);
    const fileInputRef = useRef();

    useEffect(() => { load(); }, []);

    const load = async () => {
        try {
            const [studRes, statsRes] = await Promise.all([
                api.get('/hod/students'),
                api.get('/hod/students/stats'),
            ]);
            setStudents(studRes.data.students || []);
            setStatsMap(statsRes.data || { attMap: {}, cgpaMap: {}, sgpaMap: {}, backlogMap: {} });
        } catch { }
        finally { setLoading(false); }
    };

    // Derived unique values for filter dropdowns
    const uniqueYears    = useMemo(() => [...new Set(students.map(s => s.year))].sort(), [students]);
    const uniqueSections = useMemo(() => [...new Set(students.map(s => s.section))].sort(), [students]);

    // Filtered student list
    const filtered = useMemo(() => {
        let list = students;
        if (filterYear)    list = list.filter(s => String(s.year)    === String(filterYear));
        if (filterSection) list = list.filter(s => s.section         === filterSection);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(s =>
                s.full_name?.toLowerCase().includes(q) ||
                s.roll_number?.toLowerCase().includes(q) ||
                s.email?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [students, filterYear, filterSection, search]);

    const clearFilters = () => { setFilterYear(''); setFilterSection(''); setSearch(''); };
    const hasFilter    = filterYear || filterSection || search.trim();

    const handleOpenAdd = () => {
        setIsEditing(false); setEditId(null);
        setForm({ full_name: '', email: '', phone: '', password: '', roll_number: '', year: 1, semester: 1, section: 'A', parent_name: '', parent_phone: '', date_of_birth: '' });
        setShowModal(true);
    };

    const handleOpenEdit = (student) => {
        setIsEditing(true); setEditId(student.id);
        setForm({
            full_name: student.full_name || '', email: student.email || '', phone: student.phone || '',
            password: '', roll_number: student.roll_number || '', year: student.year || 1,
            semester: student.semester || 1, section: student.section || 'A',
            parent_name: student.parent_name || '', parent_phone: student.parent_phone || '',
            date_of_birth: student.date_of_birth || ''
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                const payload = { ...form };
                if (!payload.password) delete payload.password;
                await api.patch(`/hod/students/${editId}`, payload);
            } else {
                await api.post('/hod/students', form);
            }
            setShowModal(false); load();
        } catch (err) { alert(err.response?.data?.error || 'Error saving student data'); }
    };

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // WhatsApp report → goes to parent's phone
    const handleSendReport = (student) => {
        const parentPhone = student.parent_phone;
        const studentPhone = student.phone;

        if (!parentPhone && !studentPhone) {
            alert('No phone number registered for this student or their parent.');
            return;
        }

        // Use parent phone; fall back to student phone with a notice
        let rawPhone = parentPhone || studentPhone;
        if (!parentPhone && studentPhone) {
            if (!window.confirm('No parent phone registered. Send to student\'s own number instead?')) return;
        }

        let phone = rawPhone.replace(/\D/g, '');
        if (phone.length === 10) phone = '91' + phone;

        const att   = statsMap.attMap?.[student.id]?.percentage;
        const cgpa  = statsMap.cgpaMap?.[student.id];
        const bl    = statsMap.backlogMap?.[student.id] || 0;

        const attLine  = att  != null ? `📊 Attendance: ${att}%${att < 75 ? ' ⚠ BELOW 75%' : ' ✓'}` : '';
        const cgpaLine = cgpa != null ? `🎓 CGPA: ${Number(cgpa).toFixed(2)}` : '';
        const blLine   = bl   > 0    ? `⚠ Active Backlogs: ${bl} subject(s)` : '';

        const lines = [attLine, cgpaLine, blLine].filter(Boolean).join('\n');

        const message = encodeURIComponent(
            `*Vignan College — Academic Update*\n\n` +
            `Dear Parent,\n\n` +
            `This is an update regarding your ward *${student.full_name}* (Roll: ${student.roll_number}).\n` +
            `Year ${student.year} · Semester ${student.semester} · Section ${student.section}\n\n` +
            (lines ? `${lines}\n\n` : '') +
            `Please check the student portal for detailed marks and attendance.\n\n` +
            `For queries, contact the HOD — Vignan College.`
        );
        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    };


    // Import handlers
    const openImport  = () => { setImportFile(null); setImportResult(null); setShowImport(true); };
    const closeImport = () => { if (!importing) { setShowImport(false); setImportFile(null); setImportResult(null); } };

    const handleFileChange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        const ext = f.name.split('.').pop().toLowerCase();
        if (!['csv', 'xlsx', 'xls'].includes(ext)) { setImportResult({ success: false, message: 'Only .csv and .xlsx files are accepted.' }); return; }
        setImportFile(f); setImportResult(null);
    };

    const handleImport = async () => {
        if (!importFile) return;
        setImporting(true); setImportResult(null);
        try {
            const fd = new FormData(); fd.append('file', importFile);
            const r = await api.post('/hod/students/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setImportResult({ success: true, message: r.data.message, inserted: r.data.inserted, updated: r.data.updated });
            load();
        } catch (err) {
            const data = err.response?.data;
            setImportResult({ success: false, message: data?.error || 'Import failed', details: data?.details });
        } finally { setImporting(false); }
    };

    const { attMap, cgpaMap, sgpaMap, backlogMap } = statsMap;

    const columns = [
        { key: 'roll',    header: 'Roll No',    accessor: 'roll_number' },
        { key: 'name',    header: 'Name',        accessor: 'full_name'   },
        { key: 'year',    header: 'Yr/Sem',      render: r => <span style={{ fontSize: '0.8rem' }}>{r.year}/{r.semester}</span> },
        { key: 'section', header: 'Section',     accessor: 'section'     },
        {
            key: 'cgpa', header: 'CGPA',
            render: r => {
                const val = cgpaMap[r.id];
                return val != null
                    ? <span style={{ fontWeight: 700, color: gpaColor(val) }}>{Number(val).toFixed(2)}</span>
                    : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>;
            }
        },
        {
            key: 'sgpa', header: 'SGPA',
            render: r => {
                const val = sgpaMap?.[r.id];
                return val != null
                    ? <span style={{ fontWeight: 600, color: gpaColor(val) }}>{Number(val).toFixed(2)}</span>
                    : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>;
            }
        },
        {
            key: 'att', header: 'Attendance',
            render: r => {
                const att = attMap[r.id]?.percentage;
                return att != null
                    ? <span style={{ fontWeight: 700, color: attColor(att) }}>{att}%</span>
                    : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>;
            }
        },
        {
            key: 'backlogs', header: 'Backlogs',
            render: r => {
                const bl = backlogMap[r.id] || 0;
                return bl > 0
                    ? <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700, background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>⚠ {bl}</span>
                    : <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>—</span>;
            }
        },
        {
            key: 'status', header: 'Status', render: r => (
                <span style={{
                    padding: '3px 10px', borderRadius: 100, fontSize: '0.7rem', fontWeight: 600,
                    background: r.is_active ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.1)',
                    color: r.is_active ? '#15803D' : '#DC2626',
                }}>{r.is_active ? 'Active' : 'Inactive'}</span>
            )
        },
        {
            key: 'actions', header: 'Actions', render: r => (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setViewStudent(r)}
                        className="btn btn-sm"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'linear-gradient(135deg,#1e40af,#7c3aed)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 6 }}
                        title="View Full Student Data"
                    >
                        <HiOutlineEye size={13} /> View Data
                    </button>
                    <button
                        onClick={() => handleOpenEdit(r)}
                        className="btn btn-sm btn-outline"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
                        title="Edit Student"
                    >
                        <HiOutlinePencilAlt size={13} /> Edit
                    </button>
                    <button
                        onClick={() => handleSendReport(r)}
                        className="btn btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.75rem', background: '#25D366', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 6 }}
                        title="Send WhatsApp Report"
                    >
                        <HiOutlineChatAlt2 size={13} /> Report
                    </button>
                </div>
            )
        }
    ];

    if (loading) return <DashboardLayout><LoadingSpinner /></DashboardLayout>;

    return (
        <DashboardLayout>
            {/* ── Page header ──────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Student Management</h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Manage all students in your department &nbsp;·&nbsp;
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{filtered.length}</span>
                        {hasFilter ? ` of ${students.length}` : ''} students
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={openImport} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <HiOutlineUpload size={15} /> Import
                    </button>
                    <button onClick={handleOpenAdd} className="btn btn-hod">+ Add Student</button>
                </div>
            </div>

            {/* ── Filter Bar ───────────────────────────────────────────────── */}
            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '14px 16px', marginBottom: 18,
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>
                    <HiOutlineFilter size={16} /> Filters
                </div>

                {/* Search */}
                <div style={{ flex: '1 1 220px', position: 'relative' }}>
                    <HiOutlineSearch size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, roll no, email…"
                        style={{
                            width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                            borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)',
                            fontSize: '0.82rem', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                        }}
                    />
                </div>

                {/* Year filter */}
                <select
                    value={filterYear}
                    onChange={e => setFilterYear(e.target.value)}
                    style={{
                        padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--bg-primary)', fontSize: '0.82rem', color: 'var(--text-primary)',
                        cursor: 'pointer', minWidth: 110,
                    }}
                >
                    <option value="">All Years</option>
                    {uniqueYears.map(y => <option key={y} value={y}>Year {y}</option>)}
                </select>

                {/* Section filter */}
                <select
                    value={filterSection}
                    onChange={e => setFilterSection(e.target.value)}
                    style={{
                        padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)',
                        background: 'var(--bg-primary)', fontSize: '0.82rem', color: 'var(--text-primary)',
                        cursor: 'pointer', minWidth: 120,
                    }}
                >
                    <option value="">All Sections</option>
                    {uniqueSections.map(s => <option key={s} value={s}>Section {s}</option>)}
                </select>

                {/* Clear */}
                {hasFilter && (
                    <button
                        onClick={clearFilters}
                        style={{
                            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                            background: 'transparent', fontSize: '0.78rem', color: 'var(--text-secondary)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                        }}
                    >
                        <HiOutlineX size={13} /> Clear
                    </button>
                )}
            </div>

            {/* Info chips when filters are active */}
            {hasFilter && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {filterYear && (
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4 }}>
                            Year {filterYear} <button onClick={() => setFilterYear('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6366f1', display: 'flex' }}><HiOutlineX size={11} /></button>
                        </span>
                    )}
                    {filterSection && (
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(20,184,166,0.1)', color: '#0d9488', display: 'flex', alignItems: 'center', gap: 4 }}>
                            Section {filterSection} <button onClick={() => setFilterSection('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#0d9488', display: 'flex' }}><HiOutlineX size={11} /></button>
                        </span>
                    )}
                    {search.trim() && (
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(245,158,11,0.1)', color: '#b45309', display: 'flex', alignItems: 'center', gap: 4 }}>
                            "{search}" <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#b45309', display: 'flex' }}><HiOutlineX size={11} /></button>
                        </span>
                    )}
                </div>
            )}

            <DataTable columns={columns} data={filtered} />

            {/* ── View Student Data Modal ───────────────────────────────────── */}
            <StudentDataModal student={viewStudent} onClose={() => setViewStudent(null)} />

            {/* ── Add/Edit Student Modal ────────────────────────────────────── */}
            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={isEditing ? 'Edit Student Details' : 'Add New Student'} size="lg">
                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="modal-section">
                        <p className="modal-section-title">Basic Information</p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Full Name <span className="required">*</span></label>
                                <input className="form-input" placeholder="e.g. Ravi Kumar" value={form.full_name} onChange={e => upd('full_name', e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Roll Number <span className="required">*</span></label>
                                <input className="form-input" placeholder="e.g. 24891A6701" value={form.roll_number} onChange={e => upd('roll_number', e.target.value)} required />
                                {isEditing && <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Updating roll number will also update their login ID.</span>}
                            </div>
                        </div>
                        <div className="form-row form-row-3">
                            <div className="form-group">
                                <label className="form-label">Year</label>
                                <select className="form-input" value={form.year} onChange={e => upd('year', parseInt(e.target.value))}>
                                    {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Semester</label>
                                <select className="form-input" value={form.semester} onChange={e => upd('semester', parseInt(e.target.value))}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Section</label>
                                <input className="form-input" placeholder="A" value={form.section} onChange={e => upd('section', e.target.value)} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Date of Birth</label>
                            <input type="date" className="form-input" value={form.date_of_birth} onChange={e => upd('date_of_birth', e.target.value)} />
                        </div>
                    </div>
                    <div className="modal-section">
                        <p className="modal-section-title">Contact Details</p>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input className="form-input" type="email" placeholder="student@example.com" value={form.email} onChange={e => upd('email', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Phone Number</label>
                                <input className="form-input" placeholder="10-digit number" value={form.phone} onChange={e => upd('phone', e.target.value)} />
                            </div>
                        </div>
                        <div className="form-row form-row-2">
                            <div className="form-group">
                                <label className="form-label">Parent / Guardian Name</label>
                                <input className="form-input" placeholder="Parent's full name" value={form.parent_name} onChange={e => upd('parent_name', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Parent / Guardian Phone</label>
                                <input className="form-input" placeholder="10-digit number" value={form.parent_phone} onChange={e => upd('parent_phone', e.target.value)} />
                            </div>
                        </div>
                    </div>
                    {!isEditing && (
                        <div className="modal-section">
                            <p className="modal-section-title">Account Security</p>
                            <div className="form-group">
                                <label className="form-label">Login Password <span className="required">*</span></label>
                                <input type="password" className="form-input" placeholder="Minimum 8 characters" value={form.password} onChange={e => upd('password', e.target.value)} required minLength={8} />
                            </div>
                        </div>
                    )}
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn btn-hod">{isEditing ? 'Save Changes' : 'Create Student'}</button>
                    </div>
                </form>
            </Modal>

            {/* ── Import Modal ──────────────────────────────────────────────── */}
            <Modal isOpen={showImport} onClose={closeImport} title="Import Students" size="md">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Download Template</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                Columns: roll_number, full_name, email, phone, year, semester, section, password
                            </p>
                        </div>
                        <button onClick={downloadTemplate} className="btn btn-outline btn-sm" style={{ whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <HiOutlineDownload size={14} /> Template
                        </button>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>Select File</p>
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: `2px dashed ${importFile ? '#2E7D32' : 'var(--border)'}`,
                                borderRadius: 10, padding: '28px 20px', textAlign: 'center',
                                cursor: 'pointer', background: importFile ? 'rgba(46,125,50,0.04)' : 'var(--bg-secondary)',
                            }}
                        >
                            {importFile ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                    <HiOutlineCheckCircle size={20} color="#2E7D32" />
                                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#2E7D32' }}>{importFile.name}</span>
                                    <button type="button" onClick={e => { e.stopPropagation(); setImportFile(null); setImportResult(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 2 }}>
                                        <HiOutlineX size={16} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <HiOutlineUpload size={24} color="var(--text-tertiary)" style={{ margin: '0 auto 8px' }} />
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Click to choose a file</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>Accepts .csv or .xlsx</p>
                                </>
                            )}
                        </div>
                        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
                    </div>

                    {importResult && (
                        <div style={{ padding: '14px 16px', borderRadius: 10, background: importResult.success ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.07)', border: `1px solid ${importResult.success ? 'rgba(22,163,74,0.25)' : 'rgba(220,38,38,0.2)'}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: importResult.details ? 10 : 0 }}>
                                {importResult.success ? <HiOutlineCheckCircle size={18} color="#16A34A" /> : <HiOutlineExclamationCircle size={18} color="#DC2626" />}
                                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: importResult.success ? '#15803D' : '#B91C1C' }}>{importResult.message}</span>
                            </div>
                            {importResult.success && (
                                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                                    <span style={{ fontSize: '0.78rem', color: '#15803D' }}>✔ {importResult.inserted} new students added</span>
                                    <span style={{ fontSize: '0.78rem', color: '#2563EB' }}>↻ {importResult.updated} existing updated</span>
                                </div>
                            )}
                            {importResult.details?.length > 0 && (
                                <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {importResult.details.map((d, i) => (
                                        <li key={i} style={{ fontSize: '0.78rem', color: '#B91C1C', padding: '4px 8px', background: 'rgba(220,38,38,0.06)', borderRadius: 6 }}>{d}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                        <button className="btn btn-outline" onClick={closeImport} disabled={importing}>Cancel</button>
                        <button className="btn btn-hod" onClick={handleImport} disabled={!importFile || importing} style={{ minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            {importing ? (<><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />Importing…</>) : 'Import Students'}
                        </button>
                    </div>
                </div>
            </Modal>
        </DashboardLayout>
    );
}
