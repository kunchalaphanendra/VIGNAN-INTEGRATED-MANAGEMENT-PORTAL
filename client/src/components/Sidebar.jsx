import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    HiOutlineViewGrid, HiOutlineUserGroup, HiOutlineAcademicCap, HiOutlineClipboardList,
    HiOutlineCalendar, HiOutlineBell as HiOutlineMegaphone, HiOutlineChartBar,
    HiOutlineClipboardCheck, HiOutlineClock, HiOutlineDocumentText, HiOutlineChat,
    HiOutlineBookOpen, HiOutlinePresentationChartBar, HiOutlineFlag,
    HiOutlineBriefcase, HiOutlineMail, HiOutlineRefresh, HiOutlineDatabase,
} from 'react-icons/hi';

const roleColors = {
    principal: { main: '#B71C1C', bg: 'rgba(183,28,28,0.07)', border: 'rgba(183,28,28,0.18)' },
    hod:       { main: '#2E7D32', bg: 'rgba(46,125,50,0.07)',  border: 'rgba(46,125,50,0.18)' },
    faculty:   { main: '#1565C0', bg: 'rgba(21,101,192,0.07)', border: 'rgba(21,101,192,0.18)' },
    student:   { main: '#6A1B9A', bg: 'rgba(106,27,154,0.07)', border: 'rgba(106,27,154,0.18)' },
};

// Helper: create a section-header entry
const sec = (label) => ({ type: 'section', label });

const menuItems = {
    principal: [
        { to: '/principal/dashboard', icon: HiOutlineViewGrid, label: 'Dashboard' },

        sec('MANAGEMENT'),
        { to: '/principal/departments', icon: HiOutlineAcademicCap, label: 'Departments' },
        { to: '/principal/hods',        icon: HiOutlineUserGroup,   label: 'HOD Management' },

        sec('OVERVIEW & CONTROL'),
        { to: '/principal/students', icon: HiOutlineAcademicCap, label: 'Student Overview' },
        { to: '/principal/reports',  icon: HiOutlineChartBar,    label: 'Reports' },

        sec('COMMUNICATION & ENGAGEMENT'),
        { to: '/principal/notices', icon: HiOutlineMegaphone,            label: 'Notices' },
        { to: '/principal/polls',   icon: HiOutlinePresentationChartBar, label: 'Polls' },

        sec('STUDENT SERVICES'),
        { to: '/principal/complaints', icon: HiOutlineFlag, label: 'Complaints' },

        sec('PLACEMENT & EVENTS'),
        { to: '/principal/placements', icon: HiOutlineBriefcase, label: 'Placements' },
        { to: '/principal/calendar',   icon: HiOutlineCalendar,  label: 'Calendar' },

        sec('SYSTEM'),
        { to: '/principal/settings', icon: HiOutlineViewGrid, label: 'System Settings' },
    ],

    hod: [
        { to: '/hod/dashboard', icon: HiOutlineViewGrid, label: 'Dashboard' },

        sec('USER MANAGEMENT'),
        { to: '/hod/faculty',    icon: HiOutlineUserGroup,   label: 'Faculty' },
        { to: '/hod/students',   icon: HiOutlineAcademicCap, label: 'Students' },
        { to: '/hod/promote',    icon: HiOutlineAcademicCap, label: 'Promote Students 🎓' },
        { to: '/hod/reset-data', icon: HiOutlineRefresh,     label: 'Reset Data 🗑️' },

        sec('ACADEMIC SETUP'),
        { to: '/hod/subjects',          icon: HiOutlineBookOpen,      label: 'Subjects' },
        { to: '/hod/assignments',       icon: HiOutlineClipboardList, label: 'Assign Classes' },
        { to: '/hod/periods',           icon: HiOutlineClock,         label: 'Class Periods' },
        { to: '/hod/timetable',         icon: HiOutlineCalendar,      label: 'Timetable' },
        { to: '/hod/academic-calendar', icon: HiOutlineCalendar,      label: 'Academic Calendar' },

        sec('DAILY OPERATIONS'),
        { to: '/hod/attendance', icon: HiOutlineClipboardCheck, label: 'Attendance' },
        { to: '/hod/marks',      icon: HiOutlineDocumentText,   label: 'Marks' },
        { to: '/hod/leaves',     icon: HiOutlineClock,          label: 'Leaves' },

        sec('REPORTS & ANALYTICS'),
        { to: '/hod/analytics',       icon: HiOutlineChartBar, label: 'Analytics' },
        { to: '/hod/monthly-reports', icon: HiOutlineMail,     label: 'Monthly Reports' },

        sec('STUDENT SERVICES'),
        { to: '/hod/complaints', icon: HiOutlineFlag,          label: 'Complaints' },
        { to: '/hod/feedback',   icon: HiOutlineClipboardList, label: 'Feedback Portal' },

        sec('COMMUNICATION'),
        { to: '/hod/notices', icon: HiOutlineMegaphone, label: 'Notices' },

        sec('GENERAL'),
        { to: '/hod/calendar',   icon: HiOutlineCalendar,  label: 'Calendar' },
        { to: '/hod/placements', icon: HiOutlineBriefcase, label: 'Placements' },

        sec('SYSTEM'),
        { to: '/hod/backup', icon: HiOutlineDatabase, label: '🛡 Database Backup' },
    ],

    faculty: [
        { to: '/faculty/dashboard', icon: HiOutlineViewGrid, label: 'Dashboard' },

        sec('TEACHING'),
        { to: '/faculty/timetable',  icon: HiOutlineCalendar,       label: 'Timetable' },
        { to: '/faculty/attendance', icon: HiOutlineClipboardCheck, label: 'Attendance' },
        { to: '/faculty/marks',      icon: HiOutlineDocumentText,   label: 'Marks' },

        sec('STUDENT INTERACTION'),
        { to: '/faculty/student-leaves', icon: HiOutlineClock,    label: 'Student Leaves' },
        { to: '/faculty/projects',       icon: HiOutlineBookOpen, label: 'Projects' },
        { to: '/faculty/polls',          icon: HiOutlineChat,     label: 'Polls' },

        sec('PERSONAL'),
        { to: '/faculty/my-leaves', icon: HiOutlineClipboardList, label: 'My Leaves' },

        sec('COMMUNICATION'),
        { to: '/faculty/notices', icon: HiOutlineMegaphone, label: 'Notices' },

        sec('GENERAL'),
        { to: '/faculty/calendar',   icon: HiOutlineCalendar,  label: 'Calendar' },
        { to: '/faculty/placements', icon: HiOutlineBriefcase, label: 'Placements' },
    ],

    student: [
        { to: '/student/dashboard', icon: HiOutlineViewGrid, label: 'Dashboard' },

        sec('ACADEMICS'),
        { to: '/student/timetable',  icon: HiOutlineCalendar,       label: 'Timetable' },
        { to: '/student/attendance', icon: HiOutlineClipboardCheck, label: 'Attendance' },
        { to: '/student/marks',      icon: HiOutlineDocumentText,   label: 'Marks' },
        { to: '/student/grades',     icon: HiOutlineChartBar,       label: 'Grades & GPA' },

        sec('ACTIVITIES'),
        { to: '/student/projects', icon: HiOutlineBookOpen, label: 'Projects' },

        sec('REQUESTS & SERVICES'),
        { to: '/student/leaves',     icon: HiOutlineClock,         label: 'Leaves' },
        { to: '/student/complaints', icon: HiOutlineFlag,          label: 'Complaints' },
        { to: '/student/feedback',   icon: HiOutlineClipboardList, label: 'Feedback' },

        sec('COMMUNICATION'),
        { to: '/student/notices', icon: HiOutlineMegaphone, label: 'Notices' },

        sec('GENERAL'),
        { to: '/student/calendar',   icon: HiOutlineCalendar,  label: 'Calendar' },
        { to: '/student/placements', icon: HiOutlineBriefcase, label: 'Placements' },
    ],
};

export default function Sidebar({ isOpen, onClose }) {
    const { user } = useAuth();
    if (!user) return null;

    const items  = menuItems[user.role] || [];
    const colors = roleColors[user.role] || roleColors.principal;

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 40,
                    background: 'rgba(0,0,0,0.5)',
                    animation: 'fadeIn 0.2s ease',
                }} className="md:hidden" onClick={onClose} />
            )}

            <aside style={{
                position: 'fixed', top: 64, left: 0, bottom: 0, width: 240,
                zIndex: 40,
                background: 'var(--sidebar-bg)',
                borderRight: '1px solid var(--border)',
                transform: isOpen ? 'translateX(0)' : undefined,
                transition: 'transform 0.3s ease',
                display: 'flex', flexDirection: 'column',
                overflowY: 'auto',
            }}>
                {/* Role accent bar */}
                <div style={{ height: 3, background: `linear-gradient(90deg, ${colors.main}, ${colors.main}88)`, flexShrink: 0 }} />

                {/* Nav items */}
                <nav style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                    {items.map((item, idx) => {

                        /* ── Section header ───────────────────────────── */
                        if (item.type === 'section') {
                            return (
                                <div key={`sec-${idx}`} style={{
                                    marginTop: 10,
                                    marginBottom: 2,
                                    padding: '8px 14px 3px',
                                    fontSize: '0.6rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.12em',
                                    textTransform: 'uppercase',
                                    color: 'var(--text-tertiary)',
                                    borderTop: '1px solid var(--border)',
                                    userSelect: 'none',
                                }}>
                                    {item.label}
                                </div>
                            );
                        }

                        /* ── Nav link ─────────────────────────────────── */
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={onClose}
                                style={({ isActive }) => ({
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '9px 14px',
                                    borderRadius: 10,
                                    fontSize: '0.835rem',
                                    fontWeight: isActive ? 600 : 500,
                                    color: isActive ? colors.main : 'var(--text-secondary)',
                                    background: isActive ? colors.bg : 'transparent',
                                    borderLeft: isActive ? `3px solid ${colors.main}` : '3px solid transparent',
                                    transition: 'all 0.15s ease',
                                    textDecoration: 'none',
                                    letterSpacing: '-0.01em',
                                })}
                                onMouseEnter={e => {
                                    if (e.currentTarget.getAttribute('aria-current') !== 'page') {
                                        e.currentTarget.style.background = 'var(--sidebar-hover)';
                                        e.currentTarget.style.color = 'var(--text-primary)';
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (e.currentTarget.getAttribute('aria-current') !== 'page') {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-secondary)';
                                    }
                                }}
                            >
                                <item.icon size={17} style={{ flexShrink: 0 }} />
                                <span>{item.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Bottom section */}
                <div style={{
                    padding: '14px 16px',
                    borderTop: '1px solid var(--border)',
                    fontSize: '0.7rem',
                    color: 'var(--text-tertiary)',
                    textAlign: 'center',
                    flexShrink: 0,
                }}>
                    Vignan Portal v1.0
                </div>
            </aside>

            {/* Hide sidebar on mobile by default */}
            <style>{`
                @media (max-width: 767px) {
                    aside { transform: ${isOpen ? 'translateX(0)' : 'translateX(-100%)'} !important; }
                }
            `}</style>
        </>
    );
}
