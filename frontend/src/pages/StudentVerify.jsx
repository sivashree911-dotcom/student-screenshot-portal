import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentAuth } from '../context/StudentAuthContext';
import { api } from '../services/api';
import { Layers, ArrowRight, ShieldAlert, CheckCircle2, Loader2, Award, Sparkles } from 'lucide-react';

export default function StudentVerify() {
  const [registerNumber, setRegisterNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [welcomeStudent, setWelcomeStudent] = useState(null);

  const { loginStudent } = useStudentAuth();
  const navigate = useNavigate();

  const handleVerify = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setWelcomeStudent(null);

    const trimmed = registerNumber.trim();
    if (!trimmed) {
      setErrorMessage('Please enter your register number.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/students/verify', { registerNumber: trimmed });
      if (res.success && res.student) {
        setWelcomeStudent(res.student);
        loginStudent(res.student, res.token);

        // Transition smoothly to hackathons dashboard
        setTimeout(() => {
          navigate('/hackathons');
        }, 1200);
      } else {
        setErrorMessage(res.message || 'Register Number not found.\n\nPlease contact the administrator.');
      }
    } catch (err) {
      setErrorMessage(
        err.message || 'Register Number not found.\n\nPlease contact the administrator.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        position: 'relative'
      }}
    >
      {/* Background Glows */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '500px',
          height: '350px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(50px)'
        }}
      />

      <div style={{ maxWidth: '480px', width: '100%', position: 'relative', zIndex: 10 }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              boxShadow: '0 8px 24px rgba(79, 70, 229, 0.45)'
            }}
          >
            <Layers size={32} color="#ffffff" />
          </div>

          <h1
            style={{
              fontSize: '2.1rem',
              fontWeight: 800,
              letterSpacing: '-0.025em',
              marginBottom: '0.5rem',
              background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Student Screenshot Portal
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem' }}>
            Register for hackathons and upload your registration proof
          </p>
        </div>

        {/* Card Form */}
        <div className="card" style={{ padding: '2.25rem' }}>
          {welcomeStudent ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--accent-emerald)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem'
                }}
              >
                <CheckCircle2 size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-emerald)', marginBottom: '0.35rem' }}>
                Student verified successfully.
              </h3>
              <p style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600 }}>
                Welcome, {welcomeStudent.name}
              </p>
              <div
                style={{
                  marginTop: '0.75rem',
                  display: 'inline-flex',
                  gap: '0.5rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-muted)'
                }}
              >
                <span>Dept: <strong style={{ color: 'var(--text-secondary)' }}>{welcomeStudent.department}</strong></span>
                <span>•</span>
                <span>Year: <strong style={{ color: 'var(--text-secondary)' }}>{welcomeStudent.year}</strong></span>
              </div>
              <div style={{ marginTop: '1.5rem', color: 'var(--primary-400)', fontSize: '0.85rem' }}>
                Redirecting to Hackathons dashboard...
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerify}>
              <div className="form-group">
                <label
                  htmlFor="register-number-input"
                  className="form-label"
                  style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem' }}
                >
                  Enter Register Number
                </label>
                <input
                  id="register-number-input"
                  type="text"
                  className="form-input"
                  placeholder="Enter your register number (e.g. 1300)"
                  value={registerNumber}
                  onChange={(e) => setRegisterNumber(e.target.value)}
                  disabled={loading}
                  autoFocus
                  style={{
                    fontSize: '1.05rem',
                    padding: '0.85rem 1.1rem',
                    letterSpacing: '0.04em'
                  }}
                />
              </div>

              {errorMessage && (
                <div
                  className="alert alert-danger"
                  style={{ whiteSpace: 'pre-line', fontSize: '0.88rem', alignItems: 'center' }}
                >
                  <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                  <div>{errorMessage}</div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-block"
                disabled={loading || !registerNumber.trim()}
                style={{ marginTop: '0.5rem' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>CONTINUE</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info note */}
        <div style={{ textAlign: 'center', marginTop: '1.75rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          <div>Secure College Verification System</div>
          <div style={{ marginTop: '0.2rem' }}>Only approved enrolled students can submit registration proof</div>
        </div>
      </div>
    </div>
  );
}
