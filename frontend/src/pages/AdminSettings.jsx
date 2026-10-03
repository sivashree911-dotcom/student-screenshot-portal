import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Settings, Lock, CheckCircle2, AlertCircle, Server, ShieldCheck, Database, FileSpreadsheet, Loader2 } from 'lucide-react';

export default function AdminSettings() {
  const { admin } = useAdminAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  const [healthData, setHealthData] = useState(null);

  useEffect(() => {
    async function loadHealth() {
      try {
        const res = await api.get('/admin/health');
        if (res.success) setHealthData(res);
      } catch (e) {}
    }
    loadHealth();
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await api.post('/admin/auth/change-password', {
        currentPassword,
        newPassword
      });

      if (res.success) {
        setPasswordSuccess('Administrator password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Admin Settings & Diagnostics</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Configure administrator credentials and review system integrations.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Change Password Card */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={18} color="var(--primary-400)" />
            <span>Change Administrator Password</span>
          </h2>

          {passwordSuccess && (
            <div className="alert alert-success">
              <CheckCircle2 size={16} />
              <div>{passwordSuccess}</div>
            </div>
          )}

          {passwordError && (
            <div className="alert alert-danger">
              <AlertCircle size={16} />
              <div>{passwordError}</div>
            </div>
          )}

          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Current Password <span style={{ color: 'var(--accent-rose)' }}>*</span></label>
              <input
                type="password"
                className="form-input"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password <span style={{ color: 'var(--accent-rose)' }}>*</span></label>
              <input
                type="password"
                className="form-input"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password <span style={{ color: 'var(--accent-rose)' }}>*</span></label>
              <input
                type="password"
                className="form-input"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={passwordLoading}
              style={{ marginTop: '0.5rem' }}
            >
              {passwordLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </form>
        </div>

        {/* System Diagnostics Card */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={18} color="var(--accent-emerald)" />
            <span>System Diagnostics</span>
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Database size={18} color="var(--accent-cyan)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Database Connection</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>MySQL / Relational Engine</div>
                </div>
              </div>
              <span className="badge badge-active">{healthData?.database || 'Connected'}</span>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <FileSpreadsheet size={18} color="var(--accent-emerald)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Google Apps Script API</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Live Student Verification</div>
                </div>
              </div>
              <span className={`badge ${healthData?.appsScriptStatus === 'Configured' ? 'badge-active' : 'badge-college'}`}>
                {healthData?.appsScriptStatus || 'Available / Fallback Mode'}
              </span>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <ShieldCheck size={18} color="var(--accent-amber)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Authentication Protocol</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>JWT / Bcrypt Encryption</div>
                </div>
              </div>
              <span className="badge badge-active">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
