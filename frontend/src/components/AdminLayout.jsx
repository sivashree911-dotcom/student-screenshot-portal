import React from 'react';
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
  ExternalLink
} from 'lucide-react';

export default function AdminLayout() {
  const { admin, logoutAdmin } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutAdmin();
    navigate('/admin/login');
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
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="brand-icon" style={{ background: 'linear-gradient(135deg, #4f46e5, #9333ea)' }}>
              <ShieldCheck size={20} color="#ffffff" />
            </div>
            <div className="sidebar-text">
              <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>ADMIN PORTAL</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Control Center</div>
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
              >
                <Icon size={18} />
                <span className="sidebar-text">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={handleLogout}
            className="btn btn-secondary btn-sm btn-block"
            style={{ justifyContent: 'flex-start', gap: '0.65rem' }}
          >
            <LogOut size={16} />
            <span className="sidebar-text">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Logged in as</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {admin?.name || 'Portal Administrator'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
