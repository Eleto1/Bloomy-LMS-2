import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useState, useEffect } from 'react';
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function InstructorRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role !== 'instructor') return <Navigate to="/" replace />;
  return <>{children}</>;
}

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

function AppRoutes() {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Initializing...</div>;

  const getHome = () => {
    if (role === 'admin') return '/admin';
    if (role === 'instructor') return '/instructor';
    return '/student';
  };

  return (
    <Routes>
      <Route path="/login" element={<AuthLayout><Login /></AuthLayout>} />
      <Route path="/register" element={<AuthLayout><Register /></AuthLayout>} />
      <Route path="/forgot-password" element={<AuthLayout><ForgotPassword /></AuthLayout>} />

      {/* ADMIN SECTION */}
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

      {/* INSTRUCTOR SECTION */}
      <Route path="/instructor" element={<ProtectedRoute><InstructorRoute><DashboardLayout /></InstructorRoute></ProtectedRoute>}>
        <Route index element={<InstructorDashboard />} />
        <Route path="students" element={<InstructorStudents />} />
        <Route path="progress" element={<InstructorStudentProgress />} />
        <Route path="courses" element={<InstructorCourses />} />
        <Route path="final-assessment" element={<AdminFinalAssessment />} />
        <Route path="attendance" element={<AdminAttendance />} />
        <Route path="assignments" element={<Placeholder />} />
        <Route path="grades" element={<Placeholder />} />
        <Route path="announcements" element={<Placeholder />} />
      </Route>

      {/* STUDENT SECTION */}
      <Route path="/student" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<StudentDashboard />} />
        <Route path="gradebook" element={<StudentGradebook />} />
        <Route path="courses" element={<StudentCourses />} />
        <Route path="students" element={<InstructorStudents />} />
        <Route path="courses/:courseId" element={<StudentCourseViewer />} />
        <Route path="progress" element={<StudentProgress />} />
        <Route path="final-assessment" element={<StudentFinalAssessment />} />
      </Route>

      <Route path="/" element={<Navigate to={user ? getHome() : '/login'} replace />} />
    </Routes>
  );
}

function App() {
  const [init, setInit] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(() => setInit(true));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {});
    return () => subscription.unsubscribe();
  }, []);
  if (!init) return <div className="flex h-screen items-center justify-center">Loading Application...</div>;

  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </Router>
  );
}

export default App