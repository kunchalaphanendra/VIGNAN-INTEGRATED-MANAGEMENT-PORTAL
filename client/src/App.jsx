import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';

// Principal
import PrincipalDashboard from './pages/principal/Dashboard';
import PrincipalHods from './pages/principal/Hods';
import PrincipalDepartments from './pages/principal/Departments';
import PrincipalReports from './pages/principal/Reports';
import PrincipalPolls from './pages/principal/Polls';
import PrincipalComplaints from './pages/principal/Complaints';
import PrincipalNotices from './pages/principal/Notices';
import PrincipalCalendar from './pages/principal/Calendar';
import PrincipalPlacements from './pages/principal/Placements';
import PrincipalStudents from './pages/principal/Students';
import PrincipalSettings from './pages/principal/Settings';

// HOD
import HodDashboard from './pages/hod/Dashboard';
import HodFaculty from './pages/hod/Faculty';
import HodStudents from './pages/hod/Students';
import HodSubjects from './pages/hod/Subjects';
import HodAttendance from './pages/hod/Attendance';
import HodMarks from './pages/hod/Marks';
import HodLeaves from './pages/hod/Leaves';
import HodAssignments from './pages/hod/Assignments';
import HodMonthlyReports from './pages/hod/MonthlyReports';
import HodPlacements from './pages/hod/Placements';
import HodAcademicCalendar from './pages/hod/AcademicCalendar';
import HodAnalytics from './pages/hod/Analytics';
import HodPeriodsConfig from './pages/hod/PeriodsConfig';
import HodTimetable from './pages/hod/Timetable';
import HodFeedbackPortal from './pages/hod/FeedbackPortal';
import HodComplaints from './pages/hod/Complaints';
import HodPromoteStudents from './pages/hod/PromoteStudents';
import HodResetData from './pages/hod/ResetData';

// Faculty
import FacultyDashboard from './pages/faculty/Dashboard';
import FacultyAttendance from './pages/faculty/Attendance';
import FacultyMarks from './pages/faculty/Marks';
import FacultyStudentLeaves from './pages/faculty/StudentLeaves';
import FacultyMyLeaves from './pages/faculty/MyLeaves';
import FacultyTimetable from './pages/faculty/Timetable';
import FacultyProjects from './pages/faculty/Projects';
import FacultyPolls from './pages/faculty/Polls';
import FacultyPlacements from './pages/faculty/Placements';

// Student
import StudentDashboard from './pages/student/Dashboard';
import StudentAttendance from './pages/student/Attendance';
import StudentMarks from './pages/student/Marks';
import StudentGrades from './pages/student/Grades';
import StudentProjects from './pages/student/Projects';
import StudentLeaves from './pages/student/Leaves';
import StudentComplaints from './pages/student/Complaints';
import StudentTimetable from './pages/student/Timetable';
import StudentPlacements from './pages/student/Placements';
import StudentFeedback from './pages/student/Feedback';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} /></div>;
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={`/${user.role}/dashboard`} replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <Landing />} />
      <Route path="/login" element={user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <Login />} />

      {/* Principal */}
      <Route path="/principal/dashboard" element={<ProtectedRoute roles={['principal']}><PrincipalDashboard /></ProtectedRoute>} />
      <Route path="/principal/hods" element={<ProtectedRoute roles={['principal']}><PrincipalHods /></ProtectedRoute>} />
      <Route path="/principal/departments" element={<ProtectedRoute roles={['principal']}><PrincipalDepartments /></ProtectedRoute>} />
      <Route path="/principal/students" element={<ProtectedRoute roles={['principal']}><PrincipalStudents /></ProtectedRoute>} />
      <Route path="/principal/reports" element={<ProtectedRoute roles={['principal']}><PrincipalReports /></ProtectedRoute>} />
      <Route path="/principal/polls" element={<ProtectedRoute roles={['principal']}><PrincipalPolls /></ProtectedRoute>} />
      <Route path="/principal/complaints" element={<ProtectedRoute roles={['principal']}><PrincipalComplaints /></ProtectedRoute>} />
      <Route path="/principal/notices" element={<ProtectedRoute roles={['principal']}><PrincipalNotices role="principal" /></ProtectedRoute>} />
      <Route path="/principal/calendar" element={<ProtectedRoute roles={['principal']}><PrincipalCalendar role="principal" /></ProtectedRoute>} />
      <Route path="/principal/placements" element={<ProtectedRoute roles={['principal']}><PrincipalPlacements /></ProtectedRoute>} />
      <Route path="/principal/settings" element={<ProtectedRoute roles={['principal']}><PrincipalSettings /></ProtectedRoute>} />

      {/* HOD */}
      <Route path="/hod/dashboard" element={<ProtectedRoute roles={['hod']}><HodDashboard /></ProtectedRoute>} />
      <Route path="/hod/faculty" element={<ProtectedRoute roles={['hod']}><HodFaculty /></ProtectedRoute>} />
      <Route path="/hod/students" element={<ProtectedRoute roles={['hod']}><HodStudents /></ProtectedRoute>} />
      <Route path="/hod/subjects" element={<ProtectedRoute roles={['hod']}><HodSubjects /></ProtectedRoute>} />
      <Route path="/hod/attendance" element={<ProtectedRoute roles={['hod']}><HodAttendance /></ProtectedRoute>} />
      <Route path="/hod/marks" element={<ProtectedRoute roles={['hod']}><HodMarks /></ProtectedRoute>} />
      <Route path="/hod/leaves" element={<ProtectedRoute roles={['hod']}><HodLeaves /></ProtectedRoute>} />
      <Route path="/hod/assignments" element={<ProtectedRoute roles={['hod']}><HodAssignments /></ProtectedRoute>} />
      <Route path="/hod/notices" element={<ProtectedRoute roles={['hod']}><PrincipalNotices role="hod" /></ProtectedRoute>} />
      <Route path="/hod/calendar" element={<ProtectedRoute roles={['hod']}><PrincipalCalendar role="hod" /></ProtectedRoute>} />
      <Route path="/hod/monthly-reports" element={<ProtectedRoute roles={['hod']}><HodMonthlyReports /></ProtectedRoute>} />
      <Route path="/hod/placements" element={<ProtectedRoute roles={['hod']}><HodPlacements /></ProtectedRoute>} />
      <Route path="/hod/academic-calendar" element={<ProtectedRoute roles={['hod']}><HodAcademicCalendar /></ProtectedRoute>} />
      <Route path="/hod/analytics" element={<ProtectedRoute roles={['hod']}><HodAnalytics /></ProtectedRoute>} />
      <Route path="/hod/periods" element={<ProtectedRoute roles={['hod']}><HodPeriodsConfig /></ProtectedRoute>} />
      <Route path="/hod/timetable" element={<ProtectedRoute roles={['hod']}><HodTimetable /></ProtectedRoute>} />
      <Route path="/hod/feedback" element={<ProtectedRoute roles={['hod']}><HodFeedbackPortal /></ProtectedRoute>} />
      <Route path="/hod/complaints" element={<ProtectedRoute roles={['hod']}><HodComplaints /></ProtectedRoute>} />
      <Route path="/hod/promote" element={<ProtectedRoute roles={['hod']}><HodPromoteStudents /></ProtectedRoute>} />
      <Route path="/hod/reset-data" element={<ProtectedRoute roles={['hod']}><HodResetData /></ProtectedRoute>} />

      {/* Faculty */}
      <Route path="/faculty/dashboard" element={<ProtectedRoute roles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
      <Route path="/faculty/attendance" element={<ProtectedRoute roles={['faculty']}><FacultyAttendance /></ProtectedRoute>} />
      <Route path="/faculty/marks" element={<ProtectedRoute roles={['faculty']}><FacultyMarks /></ProtectedRoute>} />
      <Route path="/faculty/student-leaves" element={<ProtectedRoute roles={['faculty']}><FacultyStudentLeaves /></ProtectedRoute>} />
      <Route path="/faculty/my-leaves" element={<ProtectedRoute roles={['faculty']}><FacultyMyLeaves /></ProtectedRoute>} />
      <Route path="/faculty/timetable" element={<ProtectedRoute roles={['faculty']}><FacultyTimetable /></ProtectedRoute>} />
      <Route path="/faculty/projects" element={<ProtectedRoute roles={['faculty']}><FacultyProjects /></ProtectedRoute>} />
      <Route path="/faculty/notices" element={<ProtectedRoute roles={['faculty']}><PrincipalNotices role="faculty" /></ProtectedRoute>} />
      <Route path="/faculty/polls" element={<ProtectedRoute roles={['faculty']}><FacultyPolls /></ProtectedRoute>} />
      <Route path="/faculty/calendar" element={<ProtectedRoute roles={['faculty']}><PrincipalCalendar role="faculty" /></ProtectedRoute>} />
      <Route path="/faculty/placements" element={<ProtectedRoute roles={['faculty']}><FacultyPlacements /></ProtectedRoute>} />

      {/* Student */}
      <Route path="/student/dashboard" element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/attendance" element={<ProtectedRoute roles={['student']}><StudentAttendance /></ProtectedRoute>} />
      <Route path="/student/marks" element={<ProtectedRoute roles={['student']}><StudentMarks /></ProtectedRoute>} />
      <Route path="/student/grades" element={<ProtectedRoute roles={['student']}><StudentGrades /></ProtectedRoute>} />
      <Route path="/student/projects" element={<ProtectedRoute roles={['student']}><StudentProjects /></ProtectedRoute>} />
      <Route path="/student/leaves" element={<ProtectedRoute roles={['student']}><StudentLeaves /></ProtectedRoute>} />
      <Route path="/student/complaints" element={<ProtectedRoute roles={['student']}><StudentComplaints /></ProtectedRoute>} />
      <Route path="/student/timetable" element={<ProtectedRoute roles={['student']}><StudentTimetable /></ProtectedRoute>} />
      <Route path="/student/notices" element={<ProtectedRoute roles={['student']}><PrincipalNotices role="student" /></ProtectedRoute>} />
      <Route path="/student/calendar" element={<ProtectedRoute roles={['student']}><PrincipalCalendar role="student" /></ProtectedRoute>} />
      <Route path="/student/placements" element={<ProtectedRoute roles={['student']}><StudentPlacements /></ProtectedRoute>} />
      <Route path="/student/feedback" element={<ProtectedRoute roles={['student']}><StudentFeedback /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppRoutes />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
