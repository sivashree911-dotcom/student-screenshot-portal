import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../context/StudentAuthContext';
import { Layers, CheckCircle2, User, LogOut } from 'lucide-react';

export default function Navbar() {
  const { student, isAuthenticated, logoutStudent } = useStudentAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutStudent();
    navigate('/');
  };

  return (
    <header className="student-navbar">
      <div className="container navbar-content">
        <Link to={isAuthenticated ? "/hackathons" : "/"} className="brand-logo">
          <div className="brand-icon">
            <Layers size={20} color="#ffffff" />
          </div>
          <div>
            <span>Student Screenshot Portal</span>
          </div>
        </Link>

        {isAuthenticated && (
          <nav className="student-nav-links">
            <Link
              to="/hackathons"
              className={`student-nav-link ${location.pathname === '/hackathons' || location.pathname.startsWith('/hackathons/') ? 'active' : ''}`}
            >
              Hackathons
            </Link>
            <Link
              to="/my-submissions"
              className={`student-nav-link ${location.pathname === '/my-submissions' ? 'active' : ''}`}
            >
              My Submissions
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginLeft: '0.5rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.85rem'
                }}
              >
                <span style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center' }}>
                  <CheckCircle2 size={14} />
                </span>
                <span className="font-mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {student?.registerNumber}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>|</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {student?.name}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                title="Log out of student session"
                style={{ gap: '0.35rem' }}
              >
                <LogOut size={15} />
                <span>Logout</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
