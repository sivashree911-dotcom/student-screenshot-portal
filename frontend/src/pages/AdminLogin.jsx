import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { api } from '../services/api';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { loginAdmin } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email/username and password.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/admin/auth/login', {
        email: email.trim(),
        password
      });

      if (res.success && res.token && res.admin) {
        loginAdmin(res.token, res.admin);
        navigate('/admin/dashboard');
      } else {
        setErrorMessage(res.message || 'Invalid administrator credentials.');
      }
    } catch (err) {
      if (err.isNetworkError) {
        setErrorMessage(err.message);
      } else if (err.status === 401) {
        setErrorMessage('Invalid administrator credentials.');
      } else if (err.status === 503) {
        setErrorMessage(
          err.message || 'Database service is currently unavailable. Please verify database connectivity.'
        );
      } else {
        setErrorMessage(err.message || 'Administrator authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'var(--bg-primary)',
        position: 'relative'
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '450px',
          height: '350px',
          background: 'radial-gradient(circle, rgba(120, 157, 141, 0.15) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none'
        }}
      />

      <div style={{ maxWidth: '440px', width: '100%', position: 'relative', zIndex: 10 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              boxShadow: '0 4px 16px rgba(80, 121, 104, 0.35)'
            }}
          >
            <ShieldCheck size={30} color="#ffffff" />
          </div>

          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem', color: 'var(--brand-navy)' }}>
            EVIDERA
          </h1>
          <div style={{ fontSize: '0.92rem', color: 'var(--brand-forest)', fontWeight: 600, marginBottom: '0.4rem' }}>
            Every Milestone Matters.
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Administrator Portal • Secure System Access
          </p>
        </div>

        <div className="card" style={{ padding: '2rem' }}>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Mail size={14} />
                <span>Username / Email</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="admin@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Lock size={14} />
                <span>Password</span>
              </label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {errorMessage && (
              <div className="alert alert-danger" style={{ fontSize: '0.85rem' }}>
                <AlertCircle size={16} />
                <div>{errorMessage}</div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              disabled={loading || !email.trim() || !password}
              style={{
                marginTop: '0.75rem'
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>LOGIN</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Authorized Personnel Only • Session & Audit Logged
        </div>
      </div>
    </div>
  );
}
