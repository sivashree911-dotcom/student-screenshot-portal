import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  LayoutDashboard,
  Users,
  Trophy,
  FileCheck2,
  Users2,
  PieChart,
  Grid3X3,
  Settings,
  LogOut,
  ShieldCheck,
  Menu,
  X
} from 'lucide-react';

export default function AdminLayout() {
  const { admin, logoutAdmin } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logoutAdmin();
    navigate('/admin/login');
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/students', label: 'Students', icon: Users },
    { path: '/admin/hackathons', label: 'Hackathons', icon: Trophy },
    { path: '/admin/submissions', label: 'Submissions', icon: FileCheck2 },
    { path: '/admin/teams', label: 'Teams', icon: Users2 },
    { path: '/admin/participation', label: 'Participation', icon: PieChart },
    { path: '/admin/matrix', label: 'Reports / Matrix', icon: Grid3X3 },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="admin-wrapper">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={closeSidebar}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 42, 59, 0.4)',
            zIndex: 35,
            backdropFilter: 'blur(2px)'
          }}
        />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon">
              <ShieldCheck size={20} color="#ffffff" />
            </div>
            <div className="brand-text-wrapper">
              <span className="brand-title">EVIDERA</span>
              <span className="brand-tagline">Admin Control Center</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={closeSidebar}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
            Every Milestone Matters.
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-secondary btn-sm btn-block"
            style={{ justifyContent: 'flex-start', gap: '0.65rem' }}
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        <header className="admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ padding: '0.45rem', display: 'flex', alignItems: 'center' }}
              aria-label="Toggle admin navigation"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Logged in as</span>
              <div style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--brand-navy)' }}>
                {admin?.name || 'Portal Administrator'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <span className="badge badge-college font-mono" style={{ textTransform: 'none' }}>
              {admin?.email || 'admin@college.edu'}
            </span>
          </div>
        </header>

        <div className="admin-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
