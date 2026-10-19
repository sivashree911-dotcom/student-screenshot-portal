import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useStudentAuth } from '../context/StudentAuthContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Loader2 } from 'lucide-react';

export function StudentRoute() {
  const { isAuthenticated, loading } = useStudentAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '0.75rem' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--brand-forest)' }} />
        <div style={{ color: 'var(--brand-forest)', fontWeight: 600, fontSize: '0.95rem' }}>Loading Evidera...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { isAuthenticated, loading } = useAdminAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)', gap: '0.75rem' }}>
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--brand-forest)' }} />
        <div style={{ color: 'var(--brand-forest)', fontWeight: 600, fontSize: '0.95rem' }}>Verifying administrator session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
