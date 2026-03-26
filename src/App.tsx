import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useState, useEffect } from 'react';

// Layouts
import DashboardLayout from './components/DashboardLayout';

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
import AdminSettings from './pages/admin/AdminSettings';
import AdminSurveyAnalytics from './pages/admin/AdminSurveyAnalytics'; // UPDATED IMPORT

// Instructor Pages
import InstructorDashboard from './pages/instructor/InstructorDashboard';
import InstructorStudents from './pages/instructor/InstructorStudents';
import InstructorAttendance from './pages/instructor/InstructorAttendance';
import InstructorAssignments from './pages/instructor/InstructorAssignments';
import InstructorGrades from './pages/instructor/InstructorGrades';
import InstructorAnnouncements from './pages/instructor/InstructorAnnouncements';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentCourses from './pages/student/StudentCourses';
import StudentCourseViewer from './pages/student/StudentCourseViewer';
import StudentSchedule from './pages/student/StudentSchedule';
import StudentAssignments from './pages/student/StudentAssignments';
import StudentGrades from './pages/student/StudentGrades';
import StudentCommunity from './pages/student/StudentCommunity';
import StudentCertificates from './pages/student/StudentCertificates';
import StudentProfile from './pages/student/StudentProfile';

// Context
import { AuthProvider, useAuth } from './contexts/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role !== 'admin') return <Navigate to="/" />;
  return <>{children}</>;
}

function InstructorRoute({ children }: { children: React.ReactNode }) {
  const { role } = useAuth();
  if (role !== 'instructor') return <Navigate to="/" />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute><AdminRoute><DashboardLayout /></AdminRoute></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="instructors" element={<AdminInstructors />} />
        <Route path="courses" element={<AdminCourses />} />
        <Route path="cohorts" element={<AdminCohorts />} />
        <Route path="attendance" element={<AdminAttendance />} />
        <Route path="progress" element={<AdminProgress />} />
        <Route path="final-assessment" element={<AdminFinalAssessment />} />
        <Route path="gradebook" element={<AdminGradebook />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="survey-analytics" element={<AdminSurveyAnalytics />} />
      </Route>

      {/* Instructor Routes */}
      <Route path="/instructor" element={<ProtectedRoute><InstructorRoute><DashboardLayout /></InstructorRoute></ProtectedRoute>}>
        <Route index element={<InstructorDashboard />} />
        <Route path="students" element={<InstructorStudents />} />
        <Route path="attendance" element={<InstructorAttendance />} />
        <Route path="assignments" element={<InstructorAssignments />} />
        <Route path="grades" element={<InstructorGrades />} />
        <Route path="announcements" element={<InstructorAnnouncements />} />
      </Route>

      {/* Student Routes */}
      <Route path="/student" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<StudentDashboard />} />
        <Route path="courses" element={<StudentCourses />} />
        <Route path="courses/:courseId" element={<StudentCourseViewer />} />
        <Route path="schedule" element={<StudentSchedule />} />
        <Route path="assignments" element={<StudentAssignments />} />
        <Route path="grades" element={<StudentGrades />} />
        <Route path="community" element={<StudentCommunity />} />
        <Route path="certificates" element={<StudentCertificates />} />
        <Route path="profile" element={<StudentProfile />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" />} />
    </Routes>
  );
}

function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(() => setInitialized(true));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {});
    return () => subscription.unsubscribe();
  }, []);

  if (!initialized) return <div className="flex h-screen items-center justify-center">Initializing...</div>;

  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;