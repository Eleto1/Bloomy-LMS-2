import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminFinalAssessment from "./pages/admin/AdminFinalAssessment";
import AdminGradebook from "./pages/admin/AdminGradebook";
import AdminStudents from "./pages/admin/AdminStudents";
import AdminInstructors from "./pages/admin/AdminInstructors";
import AdminCourses from "./pages/admin/AdminCourses";
import AdminCohorts from "./pages/admin/AdminCohorts";
import AdminAttendance from "./pages/admin/AdminAttendance";
import AdminStudentProgress from "./pages/admin/AdminStudentProgress";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";

import InstructorDashboard from "./pages/instructor/InstructorDashboard";
import InstructorStudents from "./pages/instructor/InstructorStudents";
import InstructorAttendance from "./pages/instructor/InstructorAttendance";
import InstructorAssignments from "./pages/instructor/InstructorAssignments";
import InstructorGrades from "./pages/instructor/InstructorGrades";
import InstructorAnnouncements from "./pages/instructor/InstructorAnnouncements";

import StudentDashboard from "./pages/student/StudentDashboard";
import StudentCourses from "./pages/student/StudentCourses";
import StudentSchedule from "./pages/student/StudentSchedule";
import StudentAssignments from "./pages/student/StudentAssignments";
import StudentGrades from "./pages/student/StudentGrades";
import StudentCommunity from "./pages/student/StudentCommunity";
import StudentCertificates from "./pages/student/StudentCertificates";
import StudentProfile from "./pages/student/StudentProfile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/gradebook" element={<ProtectedRoute><AdminGradebook /></ProtectedRoute>} />
            <Route path="/admin/final-assessment" element={<ProtectedRoute><AdminFinalAssessment /></ProtectedRoute>} />
            <Route path="/admin/students" element={<ProtectedRoute><AdminStudents /></ProtectedRoute>} />
            <Route path="/admin/instructors" element={<ProtectedRoute><AdminInstructors /></ProtectedRoute>} />
            <Route path="/admin/courses" element={<ProtectedRoute><AdminCourses /></ProtectedRoute>} />
            <Route path="/admin/cohorts" element={<ProtectedRoute><AdminCohorts /></ProtectedRoute>} />
            <Route path="/admin/attendance" element={<ProtectedRoute><AdminAttendance /></ProtectedRoute>} />
            <Route path="/admin/progress" element={<ProtectedRoute><AdminStudentProgress /></ProtectedRoute>} />
            <Route path="/admin/payments" element={<ProtectedRoute><AdminPayments /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute><AdminReports /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />

            {/* Instructor Routes */}
            <Route path="/instructor" element={<ProtectedRoute><InstructorDashboard /></ProtectedRoute>} />
            <Route path="/instructor/students" element={<ProtectedRoute><InstructorStudents /></ProtectedRoute>} />
            <Route path="/instructor/attendance" element={<ProtectedRoute><InstructorAttendance /></ProtectedRoute>} />
            <Route path="/instructor/assignments" element={<ProtectedRoute><InstructorAssignments /></ProtectedRoute>} />
            <Route path="/instructor/grades" element={<ProtectedRoute><InstructorGrades /></ProtectedRoute>} />
            <Route path="/instructor/announcements" element={<ProtectedRoute><InstructorAnnouncements /></ProtectedRoute>} />

            {/* Student Routes */}
            <Route path="/student" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/courses" element={<ProtectedRoute><StudentCourses /></ProtectedRoute>} />
            <Route path="/student/schedule" element={<ProtectedRoute><StudentSchedule /></ProtectedRoute>} />
            <Route path="/student/assignments" element={<ProtectedRoute><StudentAssignments /></ProtectedRoute>} />
            <Route path="/student/grades" element={<ProtectedRoute><StudentGrades /></ProtectedRoute>} />
            <Route path="/student/community" element={<ProtectedRoute><StudentCommunity /></ProtectedRoute>} />
            <Route path="/student/certificates" element={<ProtectedRoute><StudentCertificates /></ProtectedRoute>} />
            <Route path="/student/profile" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;