import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import DashboardLayout from './components/DashboardLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { Linkedin } from 'lucide-react';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminStudents from './pages/admin/AdminStudents';
import AdminInstructors from './pages/admin/AdminInstructors';
import AdminCourses from './pages/admin/AdminCourses';
import AdminCohorts from './pages/admin/AdminCohorts';
import AdminAttendance from './pages/admin/AdminAttendance';
import AdminProgress from './pages/admin/AdminProgress';
import AdminFinalAssessment from './pages/admin/AdminFinalAssessment';
import AdminGradebook from './pages/admin/AdminGradebook';
import AdminPayments from './pages/admin/AdminPayments';
import AdminReports from './pages/admin/AdminReports';
import AdminSurveyAnalytics from './pages/admin/AdminSurveyAnalytics';
import AdminSettings from './pages/admin/AdminSettings';

// Instructor Pages
import InstructorStudentWork from './pages/instructor/InstructorStudentWork';
import InstructorDashboard from './pages/instructor/InstructorDashboard';
import InstructorStudents from './pages/instructor/InstructorStudents';
import InstructorCourses from './pages/instructor/InstructorCourses';
import InstructorStudentProgress from './pages/instructor/InstructorStudentProgress';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentCourses from './pages/student/StudentCourses';
import StudentCourseViewer from './pages/student/StudentCourseViewer';
import StudentProgress from './pages/student/StudentProgress';
import StudentFinalAssessment from './pages/student/StudentFinalAssessment';
import StudentGradebook from './pages/student/StudentGradebook.tsx';

const Placeholder = () => (
  <div className="p-10 text-center border-2 border-dashed m-10 rounded-lg bg-white">
    <h1 className="text-xl font-bold text-gray-600">Page Under Construction</h1>
  </div>
);

function Footer() {
  return (
    <footer className="w-full border-t border-border/40 bg-background/50 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Bloomy LMS. All rights reserved.
          </p>
          <a
            href="https://www.linkedin.com/in/koredesamuel"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 transition-colors duration-200"
          >
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-200">
              Built by&nbsp;
            </span>
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground underline-offset-4 group-hover:underline transition-colors duration-200">
              Korede Samuel
            </span>
            <Linkedin
              className="text-[#0A66C2] group-hover:brightness-125 transition-all duration-200"
              size={18}
              strokeWidth={1.8}
            />
          </a>
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────
   ROUTE GUARDS
   ────────────────────────────────────────────── */

// Blocks unauthenticated users — redirects to /login
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Blocks non-admin users
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Blocks non-instructor users
function InstructorRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role !== 'instructor') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Blocks authenticated users from auth pages
// If user is logged in, redirect to their correct dashboard
function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (user && role) return <Navigate to={`/${role}`} replace />;
  return <>{children}</>;
}

// Centered layout for auth pages (no sidebar)
function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4">
        {children}
      </div>
      <Footer />
    </div>
  );
}

/* ──────────────────────────────────────────────
   POST-LOGIN REDIRECTOR
   ──────────────────────────────────────────────
   This component watches for login events and ensures
   the user ends up on the correct role-based dashboard.
   It handles the case where the Login component does
   its own navigation to a wrong path.
*/
function PostLoginRedirector() {
  const { role, user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only redirect when:
    // 1. Not loading
    // 2. User is logged in with a role
    // 3. We haven't redirected yet this session
    // 4. User is NOT already on their correct dashboard path
    if (loading || !user || !role || hasRedirected.current) return;

    const expectedPath = `/${role}`;
    const isOnAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);
    const isOnCorrectDashboard = location.pathname === expectedPath || location.pathname.startsWith(expectedPath + '/');

    if (isOnAuthPage || !isOnCorrectDashboard) {
      // User is on auth page or wrong dashboard — redirect them
      console.log('[Redirect] Sending', role, 'to', expectedPath, 'from', location.pathname);
      hasRedirected.current = true;
      navigate(expectedPath, { replace: true });
    }
  }, [loading, user, role, location.pathname, navigate]);

  return null; // This component renders nothing
}

/* ──────────────────────────────────────────────
   MAIN ROUTER
   ────────────────────────────────────────────── */

function AppRoutes() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Initializing...</div>;

  const getHome = () => {
    if (role === 'admin') return '/admin';
    if (role === 'instructor') return '/instructor';
    return '/student';
  };

  return (
    <>
      {/* Invisible component that handles post-login redirects */}
      <PostLoginRedirector />

      <Routes>
        {/* ── AUTH PAGES ── */}
        <Route path="/login" element={<AuthLayout><PublicOnlyRoute><Login /></PublicOnlyRoute></AuthLayout>} />
        <Route path="/register" element={<AuthLayout><PublicOnlyRoute><Register /></PublicOnlyRoute></AuthLayout>} />
        <Route path="/forgot-password" element={<AuthLayout><PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute></AuthLayout>} />

        {/* ── ADMIN SECTION ── */}
        <Route path="/admin" element={<ProtectedRoute><AdminRoute><DashboardLayout /></AdminRoute></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="courses" element={<AdminCourses />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="instructors" element={<AdminInstructors />} />
          <Route path="cohorts" element={<AdminCohorts />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="progress" element={<AdminProgress />} />
          <Route path="final-assessment" element={<AdminFinalAssessment />} />
          <Route path="gradebook" element={<AdminGradebook />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="AdminSurveyAnalytics" element={<AdminSurveyAnalytics />} />
          <Route path="survey-analytics" element={<AdminSurveyAnalytics />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* ── INSTRUCTOR SECTION ── */}
        <Route path="/instructor" element={<ProtectedRoute><InstructorRoute><DashboardLayout /></InstructorRoute></ProtectedRoute>}>
          <Route index element={<InstructorDashboard />} />
          <Route path="students" element={<InstructorStudents />} />
          <Route path="progress" element={<InstructorStudentProgress />} />
          <Route path="courses" element={<InstructorCourses />} />
          <Route path="final-assessment" element={<AdminFinalAssessment />} />
          <Route path="attendance" element={<AdminAttendance />} />
          <Route path="assignments" element={<Placeholder />} />
          <Route path="grades" element={<InstructorStudentWork />} />
          <Route path="announcements" element={<Placeholder />} />
        </Route>

        {/* ── STUDENT SECTION ── */}
        <Route path="/student" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<StudentDashboard />} />
          <Route path="gradebook" element={<StudentGradebook />} />
          <Route path="courses" element={<StudentCourses />} />
          <Route path="students" element={<InstructorStudents />} />
          <Route path="courses/:courseId" element={<StudentCourseViewer />} />
          <Route path="progress" element={<StudentProgress />} />
          <Route path="final-assessment" element={<StudentFinalAssessment />} />
        </Route>

        {/* ── CATCH-ALL ── */}
        <Route path="/" element={<Navigate to={user ? getHome() : '/login'} replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </Router>
  );
}

export default App;
