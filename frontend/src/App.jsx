import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Providers
import { StudentAuthProvider } from './context/StudentAuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { StudentRoute, AdminRoute } from './components/ProtectedRoute';

// Layout
import AdminLayout from './components/AdminLayout';

// Student Pages
import StudentVerify from './pages/StudentVerify';
import HackathonDashboard from './pages/HackathonDashboard';
import HackathonDetailSubmission from './pages/HackathonDetailSubmission';
import MySubmissions from './pages/MySubmissions';

// Admin Pages
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminStudents from './pages/AdminStudents';
import AdminHackathons from './pages/AdminHackathons';
import AdminSubmissions from './pages/AdminSubmissions';
import AdminTeams from './pages/AdminTeams';
import AdminParticipation from './pages/AdminParticipation';
import AdminMatrix from './pages/AdminMatrix';
import AdminSettings from './pages/AdminSettings';

export default function App() {
  return (
    <AdminAuthProvider>
      <StudentAuthProvider>
        <Routes>
          {/* ================= Student Routes ================= */}
          <Route path="/" element={<StudentVerify />} />

          <Route element={<StudentRoute />}>
            <Route path="/hackathons" element={<HackathonDashboard />} />
            <Route path="/hackathons/:id" element={<HackathonDetailSubmission />} />
            <Route path="/my-submissions" element={<MySubmissions />} />
          </Route>

          {/* ================= Hidden Admin Routes ================= */}
          <Route path="/admin/login" element={<AdminLogin />} />

          <Route path="/admin" element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="hackathons" element={<AdminHackathons />} />
              <Route path="submissions" element={<AdminSubmissions />} />
              <Route path="teams" element={<AdminTeams />} />
              <Route path="participation" element={<AdminParticipation />} />
              <Route path="matrix" element={<AdminMatrix />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </StudentAuthProvider>
    </AdminAuthProvider>
  );
}
