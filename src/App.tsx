import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useState, useEffect } from 'react';
import DashboardLayout from './components/DashboardLayout';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCourses from './pages/admin/AdminCourses';
import AdminSurveyAnalytics from './pages/admin/AdminSurveyAnalytics';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import StudentCourses from './pages/student/StudentCourses';
import StudentCourseViewer from './pages/student/StudentCourseViewer';

// --- Placeholder Component ---
const Placeholder = () => (
  <div className="p-10 text-center border-2 border-dashed m-10 rounded-lg bg-white">
    <h1 className="text-xl font-bold text-gray-600">Page Under Construction</h1>
    <p className="text-gray-400 mt-2">This section is not yet available.</p>
  </div>
);

// --- Route Guards ---
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

// --- Main Routes ---
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
      {/* Public Routes */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to={getHome()} replace />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute><AdminRoute><DashboardLayout /></AdminRoute></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<Placeholder />} />
        <Route path="instructors" element={<Placeholder />} />
        <Route path="courses" element={<AdminCourses />} />
        <Route path="cohorts" element={<Placeholder />} />
        <Route path="attendance" element={<Placeholder />} />
        <Route path="progress" element={<Placeholder />} />
        <Route path="final-assessment" element={<Placeholder />} />
        <Route path="gradebook" element={<Placeholder />} />
        <Route path="payments" element={<Placeholder />} />
        <Route path="reports" element={<Placeholder />} />
        <Route path="survey-responses" element={<AdminSurveyAnalytics />} />
        <Route path="settings" element={<Placeholder />} />
      </Route>

      {/* Instructor Routes */}
      <Route path="/instructor" element={<ProtectedRoute><InstructorRoute><DashboardLayout /></InstructorRoute></ProtectedRoute>}>
        <Route index element={<Placeholder />} />
        <Route path="students" element={<Placeholder />} />
        <Route path="attendance" element={<Placeholder />} />
        <Route path="assignments" element={<Placeholder />} />
        <Route path="grades" element={<Placeholder />} />
        <Route path="announcements" element={<Placeholder />} />
      </Route>

      {/* Student Routes */}
      <Route path="/student" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<StudentDashboard />} />
        <Route path="courses" element={<StudentCourses />} />
        <Route path="courses/:courseId" element={<StudentCourseViewer />} />
        <Route path="schedule" element={<Placeholder />} />
        <Route path="assignments" element={<Placeholder />} />
        <Route path="grades" element={<Placeholder />} />
        <Route path="community" element={<Placeholder />} />
        <Route path="certificates" element={<Placeholder />} />
        <Route path="profile" element={<Placeholder />} />
      </Route>

      {/* Fallback */}
      <Route path="/" element={<Navigate to={user ? getHome() : '/login'} replace />} />
    </Routes>
  );
}

// --- App Component ---
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

export default App;