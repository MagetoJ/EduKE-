import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationsProvider } from "./contexts/NotificationsContext";
import DashboardLayout from "./components/layout/DashboardLayout";
import Login from "./pages/Login";
import RegisterSchool from "./pages/RegisterSchool";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import { StudentProfile } from "./pages/StudentProfile";
import Schools from "./pages/Schools";
import SchoolAdmins from "./pages/SchoolAdmins";
import { SchoolProfile } from "./pages/SchoolProfile";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";
import Staff from "./pages/Staff";
import { StaffProfile } from "./pages/StaffProfile";
import Communications from "./pages/Communications";
import Progress from "./pages/Progress";
import Academics from "./pages/Academics";
import { CourseDetail } from "./pages/CourseDetail";
import { AssignmentDetail } from "./pages/AssignmentDetail";
import { ExamDetail } from "./pages/ExamDetail";
import Fees from "./pages/Fees";
import Timetable from "./pages/Timetable";
import Leave from "./pages/Leave";
import ParentDashboard from "./pages/ParentDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import Subscriptions from "./pages/Subscriptions";
import CBC from "./pages/CBC";
// import NEMIS from "./pages/NEMIS";
// import KNEC from "./pages/KNEC";
import Transport from "./pages/Transport";
import Boarding from "./pages/Boarding";
import CurriculumAssessment from "./pages/CurriculumAssessment";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register-school" element={<RegisterSchool />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  // Force password change if required
  if (user.must_change_password) {
    return (
      <Routes>
        <Route path="/change-password" element={<ForcePasswordChange />} />
        <Route path="*" element={<Navigate to="/change-password" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/change-password" element={<ForcePasswordChange />} />
      <Route path="/login" element={<Navigate to="/dashboard" />} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:id" element={<StudentProfile />} />
        <Route path="schools" element={<Schools />} />
        <Route path="schools/:id" element={<SchoolProfile />} />
        <Route path="school-admins" element={<SchoolAdmins />} />
        <Route path="reports" element={<Reports />} />
        <Route path="staff" element={<Staff />} />
        <Route path="staff/:id" element={<StaffProfile />} />
        <Route path="communications" element={<Communications />} />
        <Route path="progress" element={<Progress />} />
        <Route path="academics" element={<Academics />} />
        <Route path="academics/courses/:id" element={<CourseDetail />} />
        <Route path="academics/assignments/:id" element={<AssignmentDetail />} />
        <Route path="academics/exams/:id" element={<ExamDetail />} />
        <Route path="fees" element={<Fees />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="leave" element={<Leave />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="settings" element={<Settings />} />
        <Route path="parent" element={<ParentDashboard />} />
        <Route path="student-dashboard" element={<StudentDashboard />} />
        <Route path="teacher-dashboard" element={<TeacherDashboard />} />
        <Route path="cbc" element={<CBC />} />
        {/* <Route path="nemis" element={<NEMIS />} />
        <Route path="knec" element={<KNEC />} /> */}
        <Route path="transport" element={<Transport />} />
        <Route path="boarding" element={<Boarding />} />
        <Route path="curriculum-assessment" element={<CurriculumAssessment />} />
        <Route path="platform-admin" element={<SuperAdminDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <Router>
          <AppRoutes />
        </Router>
      </NotificationsProvider>
    </AuthProvider>
  );
}
