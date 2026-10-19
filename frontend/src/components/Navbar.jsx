import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../context/StudentAuthContext';
import { Layers, CheckCircle2, LogOut, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { student, isAuthenticated, logoutStudent } = useStudentAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logoutStudent();
    navigate('/');
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <header className="student-navbar">
      <div className="container navbar-content">
        <Link
          to={isAuthenticated ? "/hackathons" : "/"}
          className="brand-logo"
          onClick={closeMobileMenu}
        >
          <div className="brand-icon">
            <Layers size={20} color="#ffffff" />
          </div>
          <div className="brand-text-wrapper">
            <span className="brand-title">EVIDERA</span>
            <span className="brand-tagline">Every Milestone Matters.</span>
          </div>
        </Link>

        {isAuthenticated && (
          <>
            {/* Desktop Navigation Links */}
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
                    background: 'var(--brand-pale-green)',
                    padding: '0.42rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem'
                  }}
                >
                  <span style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center' }}>
                    <CheckCircle2 size={14} />
                  </span>
                  <span className="font-mono" style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>
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

            {/* Mobile Hamburger Button */}
            <button
              type="button"
              className="nav-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
              <div className="nav-mobile-menu">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'var(--brand-pale-green)',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.85rem',
                    marginBottom: '0.5rem'
                  }}
                >
                  <span style={{ color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center' }}>
                    <CheckCircle2 size={16} />
                  </span>
                  <span className="font-mono" style={{ fontWeight: 700, color: 'var(--brand-navy)' }}>
                    {student?.registerNumber}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {student?.name}
                  </span>
                </div>

                <Link
                  to="/hackathons"
                  className={`student-nav-link ${location.pathname === '/hackathons' || location.pathname.startsWith('/hackathons/') ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  Hackathons
                </Link>
                <Link
                  to="/my-submissions"
                  className={`student-nav-link ${location.pathname === '/my-submissions' ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  My Submissions
                </Link>

                <button
                  onClick={handleLogout}
                  className="btn btn-secondary btn-sm btn-block"
                  style={{ marginTop: '0.5rem', justifyContent: 'center' }}
                >
                  <LogOut size={15} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
