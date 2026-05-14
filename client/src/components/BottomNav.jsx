import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    HiOutlineViewGrid, HiOutlineClipboardCheck, HiOutlineDocumentText,
    HiOutlineBell, HiOutlineMenu, HiOutlineUserGroup, HiOutlineAcademicCap,
    HiOutlineChartBar, HiOutlineBriefcase,
} from 'react-icons/hi';

const roleColors = {
    principal: '#B71C1C',
    hod:       '#2E7D32',
    faculty:   '#1565C0',
    student:   '#6A1B9A',
};

const bottomNavItems = {
    student: [
        { to: '/student/dashboard',  Icon: HiOutlineViewGrid,       label: 'Home' },
        { to: '/student/attendance', Icon: HiOutlineClipboardCheck, label: 'Attend' },
        { to: '/student/marks',      Icon: HiOutlineDocumentText,   label: 'Marks' },
        { to: '/student/grades',     Icon: HiOutlineChartBar,       label: 'Grades' },
        { to: '/student/notices',    Icon: HiOutlineBell,           label: 'Notices' },
    ],
    faculty: [
        { to: '/faculty/dashboard',  Icon: HiOutlineViewGrid,       label: 'Home' },
        { to: '/faculty/attendance', Icon: HiOutlineClipboardCheck, label: 'Attend' },
        { to: '/faculty/marks',      Icon: HiOutlineDocumentText,   label: 'Marks' },
        { to: '/faculty/notices',    Icon: HiOutlineBell,           label: 'Notices' },
    ],
    hod: [
        { to: '/hod/dashboard',  Icon: HiOutlineViewGrid,       label: 'Home' },
        { to: '/hod/faculty',    Icon: HiOutlineUserGroup,      label: 'Faculty' },
        { to: '/hod/students',   Icon: HiOutlineAcademicCap,   label: 'Students' },
        { to: '/hod/attendance', Icon: HiOutlineClipboardCheck, label: 'Attend' },
    ],
    principal: [
        { to: '/principal/dashboard',   Icon: HiOutlineViewGrid,    label: 'Home' },
        { to: '/principal/departments', Icon: HiOutlineAcademicCap, label: 'Depts' },
        { to: '/principal/students',    Icon: HiOutlineUserGroup,   label: 'Students' },
        { to: '/principal/placements',  Icon: HiOutlineBriefcase,   label: 'Jobs' },
        { to: '/principal/notices',     Icon: HiOutlineBell,        label: 'Notices' },
    ],
};

export default function BottomNav({ onMenuClick }) {
    const { user } = useAuth();
    if (!user) return null;

    const items = bottomNavItems[user.role] || [];
    const color = roleColors[user.role] || '#1A3C6E';

    return (
        <nav className="bottom-nav">
            {items.map(({ to, Icon, label }) => (
                <NavLink
                    key={to}
                    to={to}
                    className="bottom-nav-item"
                    style={({ isActive }) => isActive ? { color } : {}}
                >
                    {({ isActive }) => (
                        <>
                            <Icon size={22} />
                            <span className="bottom-nav-label">{label}</span>
                            {isActive && <span className="bottom-nav-dot" style={{ background: color }} />}
                        </>
                    )}
                </NavLink>
            ))}
            <button className="bottom-nav-item" onClick={onMenuClick}>
                <HiOutlineMenu size={22} />
                <span className="bottom-nav-label">More</span>
            </button>
        </nav>
    );
}
