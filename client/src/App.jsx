import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// ── Eagerly loaded (always needed) ──────────────────────────────────────────
import Landing from './pages/Landing';
import Login   from './pages/Login';

// ── Lazy-loaded by portal role ────────────────────────────────────────────────
// Principal
const PrincipalDashboard   = lazy(() => import('./pages/principal/Dashboard'));
const PrincipalHods        = lazy(() => import('./pages/principal/Hods'));
const PrincipalDepartments = lazy(() => import('./pages/principal/Departments'));
const PrincipalReports     = lazy(() => import('./pages/principal/Reports'));
const PrincipalPolls       = lazy(() => import('./pages/principal/Polls'));
const PrincipalComplaints  = lazy(() => import('./pages/principal/Complaints'));
const PrincipalNotices     = lazy(() => import('./pages/principal/Notices'));
const PrincipalCalendar    = lazy(() => import('./pages/principal/Calendar'));
const PrincipalPlacements  = lazy(() => import('./pages/principal/Placements'));
const PrincipalStudents    = lazy(() => import('./pages/principal/Students'));
const PrincipalSettings    = lazy(() => import('./pages/principal/Settings'));

// HOD
const HodDashboard        = lazy(() => import('./pages/hod/Dashboard'));
const HodFaculty          = lazy(() => import('./pages/hod/Faculty'));
const HodStudents         = lazy(() => import('./pages/hod/Students'));
const HodSubjects         = lazy(() => import('./pages/hod/Subjects'));
const HodAttendance       = lazy(() => import('./pages/hod/Attendance'));
const HodMarks            = lazy(() => import('./pages/hod/Marks'));
const HodLeaves           = lazy(() => import('./pages/hod/Leaves'));
const HodAssignments      = lazy(() => import('./pages/hod/Assignments'));
const HodMonthlyReports   = lazy(() => import('./pages/hod/MonthlyReports'));
const HodPlacements       = lazy(() => import('./pages/hod/Placements'));
const HodAcademicCalendar = lazy(() => import('./pages/hod/AcademicCalendar'));
const HodAnalytics        = lazy(() => import('./pages/hod/Analytics'));
const HodPeriodsConfig    = lazy(() => import('./pages/hod/PeriodsConfig'));
const HodTimetable        = lazy(() => import('./pages/hod/Timetable'));
const HodFeedbackPortal   = lazy(() => import('./pages/hod/FeedbackPortal'));
const HodComplaints       = lazy(() => import('./pages/hod/Complaints'));
const HodPromoteStudents  = lazy(() => import('./pages/hod/PromoteStudents'));
const HodResetData        = lazy(() => import('./pages/hod/ResetData'));

// Faculty
const FacultyDashboard     = lazy(() => import('./pages/faculty/Dashboard'));
const FacultyAttendance    = lazy(() => import('./pages/faculty/Attendance'));
const FacultyMarks         = lazy(() => import('./pages/faculty/Marks'));
const FacultyStudentLeaves = lazy(() => import('./pages/faculty/StudentLeaves'));
const FacultyMyLeaves      = lazy(() => import('./pages/faculty/MyLeaves'));
const FacultyTimetable     = lazy(() => import('./pages/faculty/Timetable'));
const FacultyProjects      = lazy(() => import('./pages/faculty/Projects'));
const FacultyPolls         = lazy(() => import('./pages/faculty/Polls'));
const FacultyPlacements    = lazy(() => import('./pages/faculty/Placements'));

// Student
const StudentDashboard  = lazy(() => import('./pages/student/Dashboard'));
const StudentAttendance = lazy(() => import('./pages/student/Attendance'));
const StudentMarks      = lazy(() => import('./pages/student/Marks'));
const StudentGrades     = lazy(() => import('./pages/student/Grades'));
const StudentProjects   = lazy(() => import('./pages/student/Projects'));
const StudentLeaves     = lazy(() => import('./pages/student/Leaves'));
const StudentComplaints = lazy(() => import('./pages/student/Complaints'));
const StudentTimetable  = lazy(() => import('./pages/student/Timetable'));
const StudentPlacements = lazy(() => import('./pages/student/Placements'));
const StudentFeedback   = lazy(() => import('./pages/student/Feedback'));

// ── Page spinner shown while lazy chunk loads ────────────────────────────────
function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '4px solid var(--border)', borderTopColor: 'var(--primary)', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={`/${user.role}/dashboard`} replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <Landing />} />
        <Route path="/login" element={user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <Login />} />

        {/* Principal */}
        <Route path="/principal/dashboard"  element={<ProtectedRoute roles={['principal']}><PrincipalDashboard /></ProtectedRoute>} />
        <Route path="/principal/hods"       element={<ProtectedRoute roles={['principal']}><PrincipalHods /></ProtectedRoute>} />
        <Route path="/principal/departments"element={<ProtectedRoute roles={['principal']}><PrincipalDepartments /></ProtectedRoute>} />
        <Route path="/principal/students"   element={<ProtectedRoute roles={['principal']}><PrincipalStudents /></ProtectedRoute>} />
        <Route path="/principal/reports"    element={<ProtectedRoute roles={['principal']}><PrincipalReports /></ProtectedRoute>} />
        <Route path="/principal/polls"      element={<ProtectedRoute roles={['principal']}><PrincipalPolls /></ProtectedRoute>} />
        <Route path="/principal/complaints" element={<ProtectedRoute roles={['principal']}><PrincipalComplaints /></ProtectedRoute>} />
        <Route path="/principal/notices"    element={<ProtectedRoute roles={['principal']}><PrincipalNotices role="principal" /></ProtectedRoute>} />
        <Route path="/principal/calendar"   element={<ProtectedRoute roles={['principal']}><PrincipalCalendar role="principal" /></ProtectedRoute>} />
        <Route path="/principal/placements" element={<ProtectedRoute roles={['principal']}><PrincipalPlacements /></ProtectedRoute>} />
        <Route path="/principal/settings"   element={<ProtectedRoute roles={['principal']}><PrincipalSettings /></ProtectedRoute>} />

        {/* HOD */}
        <Route path="/hod/dashboard"        element={<ProtectedRoute roles={['hod']}><HodDashboard /></ProtectedRoute>} />
        <Route path="/hod/faculty"          element={<ProtectedRoute roles={['hod']}><HodFaculty /></ProtectedRoute>} />
        <Route path="/hod/students"         element={<ProtectedRoute roles={['hod']}><HodStudents /></ProtectedRoute>} />
        <Route path="/hod/subjects"         element={<ProtectedRoute roles={['hod']}><HodSubjects /></ProtectedRoute>} />
        <Route path="/hod/attendance"       element={<ProtectedRoute roles={['hod']}><HodAttendance /></ProtectedRoute>} />
        <Route path="/hod/marks"            element={<ProtectedRoute roles={['hod']}><HodMarks /></ProtectedRoute>} />
        <Route path="/hod/leaves"           element={<ProtectedRoute roles={['hod']}><HodLeaves /></ProtectedRoute>} />
        <Route path="/hod/assignments"      element={<ProtectedRoute roles={['hod']}><HodAssignments /></ProtectedRoute>} />
        <Route path="/hod/notices"          element={<ProtectedRoute roles={['hod']}><PrincipalNotices role="hod" /></ProtectedRoute>} />
        <Route path="/hod/calendar"         element={<ProtectedRoute roles={['hod']}><PrincipalCalendar role="hod" /></ProtectedRoute>} />
        <Route path="/hod/monthly-reports"  element={<ProtectedRoute roles={['hod']}><HodMonthlyReports /></ProtectedRoute>} />
        <Route path="/hod/placements"       element={<ProtectedRoute roles={['hod']}><HodPlacements /></ProtectedRoute>} />
        <Route path="/hod/academic-calendar"element={<ProtectedRoute roles={['hod']}><HodAcademicCalendar /></ProtectedRoute>} />
        <Route path="/hod/analytics"        element={<ProtectedRoute roles={['hod']}><HodAnalytics /></ProtectedRoute>} />
        <Route path="/hod/periods"          element={<ProtectedRoute roles={['hod']}><HodPeriodsConfig /></ProtectedRoute>} />
        <Route path="/hod/timetable"        element={<ProtectedRoute roles={['hod']}><HodTimetable /></ProtectedRoute>} />
        <Route path="/hod/feedback"         element={<ProtectedRoute roles={['hod']}><HodFeedbackPortal /></ProtectedRoute>} />
        <Route path="/hod/complaints"       element={<ProtectedRoute roles={['hod']}><HodComplaints /></ProtectedRoute>} />
        <Route path="/hod/promote"          element={<ProtectedRoute roles={['hod']}><HodPromoteStudents /></ProtectedRoute>} />
        <Route path="/hod/reset-data"       element={<ProtectedRoute roles={['hod']}><HodResetData /></ProtectedRoute>} />

        {/* Faculty */}
        <Route path="/faculty/dashboard"     element={<ProtectedRoute roles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
        <Route path="/faculty/attendance"    element={<ProtectedRoute roles={['faculty']}><FacultyAttendance /></ProtectedRoute>} />
        <Route path="/faculty/marks"         element={<ProtectedRoute roles={['faculty']}><FacultyMarks /></ProtectedRoute>} />
        <Route path="/faculty/student-leaves"element={<ProtectedRoute roles={['faculty']}><FacultyStudentLeaves /></ProtectedRoute>} />
        <Route path="/faculty/my-leaves"     element={<ProtectedRoute roles={['faculty']}><FacultyMyLeaves /></ProtectedRoute>} />
        <Route path="/faculty/timetable"     element={<ProtectedRoute roles={['faculty']}><FacultyTimetable /></ProtectedRoute>} />
        <Route path="/faculty/projects"      element={<ProtectedRoute roles={['faculty']}><FacultyProjects /></ProtectedRoute>} />
        <Route path="/faculty/notices"       element={<ProtectedRoute roles={['faculty']}><PrincipalNotices role="faculty" /></ProtectedRoute>} />
        <Route path="/faculty/polls"         element={<ProtectedRoute roles={['faculty']}><FacultyPolls /></ProtectedRoute>} />
        <Route path="/faculty/calendar"      element={<ProtectedRoute roles={['faculty']}><PrincipalCalendar role="faculty" /></ProtectedRoute>} />
        <Route path="/faculty/placements"    element={<ProtectedRoute roles={['faculty']}><FacultyPlacements /></ProtectedRoute>} />

        {/* Student */}
        <Route path="/student/dashboard"  element={<ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>} />
        <Route path="/student/attendance" element={<ProtectedRoute roles={['student']}><StudentAttendance /></ProtectedRoute>} />
        <Route path="/student/marks"      element={<ProtectedRoute roles={['student']}><StudentMarks /></ProtectedRoute>} />
        <Route path="/student/grades"     element={<ProtectedRoute roles={['student']}><StudentGrades /></ProtectedRoute>} />
        <Route path="/student/projects"   element={<ProtectedRoute roles={['student']}><StudentProjects /></ProtectedRoute>} />
        <Route path="/student/leaves"     element={<ProtectedRoute roles={['student']}><StudentLeaves /></ProtectedRoute>} />
        <Route path="/student/complaints" element={<ProtectedRoute roles={['student']}><StudentComplaints /></ProtectedRoute>} />
        <Route path="/student/timetable"  element={<ProtectedRoute roles={['student']}><StudentTimetable /></ProtectedRoute>} />
        <Route path="/student/notices"    element={<ProtectedRoute roles={['student']}><PrincipalNotices role="student" /></ProtectedRoute>} />
        <Route path="/student/calendar"   element={<ProtectedRoute roles={['student']}><PrincipalCalendar role="student" /></ProtectedRoute>} />
        <Route path="/student/placements" element={<ProtectedRoute roles={['student']}><StudentPlacements /></ProtectedRoute>} />
        <Route path="/student/feedback"   element={<ProtectedRoute roles={['student']}><StudentFeedback /></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
