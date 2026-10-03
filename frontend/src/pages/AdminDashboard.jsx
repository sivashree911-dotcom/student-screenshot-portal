import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import Modal from '../components/Modal';
import {
  Users,
  Trophy,
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  PieChart,
  Eye,
  ArrowRight,
  AlertCircle,
  Loader2,
  Layers
} from 'lucide-react';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Quick Hackathon Selector for Participation breakdown
  const [selectedHackathonId, setSelectedHackathonId] = useState('');
  const [hackathonPartData, setHackathonPartData] = useState(null);
  const [partLoading, setPartLoading] = useState(false);

  // Quick Action Modal
  const [selectedSub, setSelectedSub] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const res = await api.get('/admin/dashboard');
      if (res.success) {
        setData(res);
        if (res.hackathons && res.hackathons.length > 0) {
          const firstHack = res.hackathons[0];
          setSelectedHackathonId(firstHack.id);
          loadHackathonParticipation(firstHack.id);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }

  async function loadHackathonParticipation(hackId) {
    if (!hackId) return;
    setPartLoading(true);
    try {
      const res = await api.get(`/participation/hackathon/${hackId}`);
      if (res.success) {
        setHackathonPartData(res);
      }
    } catch (err) {
      console.error('Failed to load hackathon participation:', err);
    } finally {
      setPartLoading(false);
    }
  }

  const handleHackathonChange = (e) => {
    const hackId = e.target.value;
    setSelectedHackathonId(hackId);
    loadHackathonParticipation(hackId);
  };

  const handleVerify = async (subId) => {
    setActionLoading(true);
    try {
      await api.put(`/submissions/admin/${subId}/verify`, {});
      setSelectedSub(null);
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error verifying submission');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (subId) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }
    setActionLoading(true);
    try {
      await api.put(`/submissions/admin/${subId}/reject`, { rejectionReason: rejectionReason.trim() });
      setSelectedSub(null);
      setShowRejectInput(false);
      setRejectionReason('');
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Error rejecting submission');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />
        <div>Loading dashboard statistics...</div>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  const stats = data?.stats || {};

  return (
    <div>
      {/* Page Title */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Admin Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Overview of approved college students, active hackathons, and registration proofs.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Approved Students</div>
          <div className="stat-value">{stats.totalStudents || 0}</div>
          <div className="stat-meta">Verified College Registry</div>
        </div>

        <div className="stat-card stat-cyan">
          <div className="stat-label">Active Hackathons</div>
          <div className="stat-value">{stats.activeHackathons || 0}</div>
          <div className="stat-meta">{stats.totalHackathons || 0} Total in Database</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Submissions</div>
          <div className="stat-value">{stats.totalSubmissions || 0}</div>
          <div className="stat-meta">Registration Proofs</div>
        </div>

        <div className="stat-card stat-amber">
          <div className="stat-label">Pending Verification</div>
          <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>{stats.pendingSubmissions || 0}</div>
          <div className="stat-meta">Awaiting Admin Action</div>
        </div>

        <div className="stat-card stat-emerald">
          <div className="stat-label">Verified Submissions</div>
          <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>{stats.verifiedSubmissions || 0}</div>
          <div className="stat-meta">Confirmed Registrations</div>
        </div>

        <div className="stat-card stat-rose">
          <div className="stat-label">Rejected Proofs</div>
          <div className="stat-value" style={{ color: 'var(--accent-rose)' }}>{stats.rejectedSubmissions || 0}</div>
          <div className="stat-meta">Requires Student Re-upload</div>
        </div>
      </div>

      {/* Participation Overview Card with Dropdown */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PieChart size={20} color="var(--primary-400)" />
              <span>Participation Overview</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Dynamic participation analytics calculated strictly from verified team submissions.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label className="form-label" style={{ margin: 0 }}>Select Hackathon:</label>
            <select
              className="form-select"
              value={selectedHackathonId}
              onChange={handleHackathonChange}
              style={{ width: 'auto', minWidth: '240px', fontWeight: 600 }}
            >
              {data?.hackathons?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {partLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            <div>Calculating participation statistics...</div>
          </div>
        ) : hackathonPartData ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL STUDENTS</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff' }}>{hackathonPartData.summary?.totalStudents || 0}</div>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>PARTICIPATED</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>{hackathonPartData.summary?.participatedCount || 0}</div>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--accent-rose)', fontWeight: 600 }}>NOT PARTICIPATED</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-rose)' }}>{hackathonPartData.summary?.notParticipatedCount || 0}</div>
              </div>

              <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--primary-400)', fontWeight: 600 }}>PARTICIPATION RATE</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary-400)' }}>{hackathonPartData.summary?.participationRate || 0}%</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Participation Progress</span>
                <span style={{ fontWeight: 700, color: '#ffffff' }}>{hackathonPartData.summary?.participationRate || 0}%</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, hackathonPartData.summary?.participationRate || 0)}%`,
                    background: 'var(--primary-gradient)',
                    borderRadius: 'var(--radius-full)',
                    transition: 'width 0.5s ease'
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
              <Link to={`/admin/participation?hackathonId=${selectedHackathonId}`} className="btn btn-outline btn-sm">
                <span>View Full Participation Details & Export CSV</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* Recent Submissions Feed */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Recent Submissions Feed</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Latest student proof uploads awaiting review.</p>
          </div>
          <Link to="/admin/submissions" className="btn btn-secondary btn-sm">
            <span>View All Submissions</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="table-responsive">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Submission ID</th>
                <th>Register No</th>
                <th>Hackathon</th>
                <th>Submitted Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentSubmissions?.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No recent submissions.
                  </td>
                </tr>
              ) : (
                data?.recentSubmissions?.map((sub) => (
                  <tr key={sub.id}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--primary-400)' }}>
                      {sub.submission_id}
                    </td>
                    <td className="font-mono">{sub.student_register_number}</td>
                    <td style={{ fontWeight: 600 }}>{sub.hackathon_name}</td>
                    <td>{formatDate(sub.created_at)}</td>
                    <td>
                      <span className={`badge ${sub.status === 'Verified' ? 'badge-verified' : sub.status === 'Rejected' ? 'badge-rejected' : 'badge-pending'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={async () => {
                          const res = await api.get(`/submissions/${sub.id}`);
                          if (res.success) setSelectedSub(res.submission);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <Eye size={13} />
                        <span>Review</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review & Verify Modal */}
      {selectedSub && (
        <Modal
          isOpen={Boolean(selectedSub)}
          onClose={() => {
            setSelectedSub(null);
            setShowRejectInput(false);
          }}
          title={`Review Submission - ${selectedSub.submission_id}`}
        >
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--primary-400)', fontWeight: 700 }}>{selectedSub.hackathon_institution}</div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{selectedSub.hackathon_name}</h3>
              <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Submitted by: <strong className="font-mono" style={{ color: '#ffffff' }}>{selectedSub.student_register_number}</strong> on {formatDate(selectedSub.created_at)}
              </div>
            </div>

            {/* Team Members */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Team Members ({selectedSub.team_members?.length || 0}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {selectedSub.team_members?.map((m, i) => (
                  <div key={i} style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <div>
                      <strong>{m.name}</strong> {m.register_number ? `(${m.register_number})` : ''} {m.department ? `• ${m.department}` : ''}
                    </div>
                    <span className={`badge ${m.is_captain ? 'badge-college' : m.member_type === 'External' ? 'badge-external' : 'badge-college'}`} style={{ fontSize: '0.7rem' }}>
                      {m.is_captain ? 'Captain' : m.member_type}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Screenshot */}
            {selectedSub.screenshot_path && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Proof Screenshot:</div>
                <div style={{ background: '#000', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={`/uploads/screenshots/${selectedSub.screenshot_path}`}
                    alt="Proof"
                    style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}

            {/* Rejection input box */}
            {showRejectInput && (
              <div style={{ marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.08)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <label className="form-label" style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>
                  Reason for Rejection (Required):
                </label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="e.g. Screenshot does not clearly show successful registration."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              {showRejectInput ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(selectedSub.id)}
                    className="btn btn-danger btn-sm"
                    disabled={actionLoading || !rejectionReason.trim()}
                  >
                    Confirm Rejection
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(true)}
                    className="btn btn-danger btn-sm"
                    disabled={actionLoading}
                  >
                    <XCircle size={15} />
                    <span>REJECT PROOF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerify(selectedSub.id)}
                    className="btn btn-success btn-sm"
                    disabled={actionLoading}
                  >
                    <CheckCircle2 size={15} />
                    <span>VERIFY PROOF</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
