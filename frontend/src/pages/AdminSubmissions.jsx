import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Modal from '../components/Modal';
import {
  FileCheck2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  AlertCircle,
  ExternalLink,
  Loader2,
  Maximize2
} from 'lucide-react';

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [hackathons, setHackathons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [hackathonFilter, setHackathonFilter] = useState('All');
  const [search, setSearch] = useState('');

  // Selected Submission Modal
  const [selectedSub, setSelectedSub] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [zoomScreenshot, setZoomScreenshot] = useState(false);

  useEffect(() => {
    loadSubmissions();
    loadHackathonsList();
  }, []);

  async function loadHackathonsList() {
    try {
      const res = await api.get('/hackathons/admin/all');
      if (res.success) setHackathons(res.hackathons || []);
    } catch (e) {}
  }

  async function loadSubmissions() {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter !== 'All') queryParams.append('status', statusFilter);
      if (hackathonFilter !== 'All') queryParams.append('hackathonId', hackathonFilter);
      if (search) queryParams.append('search', search);

      const res = await api.get(`/submissions/admin/all?${queryParams.toString()}`);
      if (res.success) {
        setSubmissions(res.submissions || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  }

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    loadSubmissions();
  };

  const openReviewModal = async (sub) => {
    try {
      const res = await api.get(`/submissions/${sub.id}`);
      if (res.success) {
        setSelectedSub(res.submission);
        setShowRejectInput(false);
        setRejectionReason(res.submission.rejection_reason || '');
      }
    } catch (err) {
      setSelectedSub(sub);
    }
  };

  const handleVerify = async (subId) => {
    setActionLoading(true);
    try {
      await api.put(`/submissions/admin/${subId}/verify`, {});
      setSelectedSub(null);
      loadSubmissions();
    } catch (err) {
      alert(err.message || 'Error verifying submission.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (subId) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a mandatory reason for rejecting this submission.');
      return;
    }
    setActionLoading(true);
    try {
      await api.put(`/submissions/admin/${subId}/reject`, { rejectionReason: rejectionReason.trim() });
      setSelectedSub(null);
      setShowRejectInput(false);
      setRejectionReason('');
      loadSubmissions();
    } catch (err) {
      alert(err.message || 'Error rejecting submission.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Submission Management</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Inspect student uploaded screenshots, verify registrations, or reject invalid proofs.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <form onSubmit={handleFilterSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Search ID / Reg No:</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. SUB-2026 or 1300"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Status:</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Verified">Verified</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Hackathon:</label>
            <select
              className="form-select"
              value={hackathonFilter}
              onChange={(e) => setHackathonFilter(e.target.value)}
            >
              <option value="All">All Hackathons</option>
              {hackathons.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
            <Search size={16} />
            <span>Apply Filter</span>
          </button>
        </form>
      </div>

      {/* Submissions Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            Proof Submissions ({submissions.length})
          </h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            <div>Loading submissions...</div>
          </div>
        ) : error ? (
          <div className="alert alert-danger" style={{ margin: '1.5rem' }}>{error}</div>
        ) : submissions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
            No submissions found matching criteria.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Submission ID</th>
                  <th>Submitter (Captain)</th>
                  <th>Hackathon</th>
                  <th>Team Size</th>
                  <th>Submitted At</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--primary-400)' }}>
                      {sub.submission_id}
                    </td>
                    <td>
                      <div className="font-mono" style={{ fontWeight: 700 }}>{sub.student_register_number}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{sub.hackathon_name}</td>
                    <td>{sub.team_size} Members</td>
                    <td>{formatDate(sub.created_at)}</td>
                    <td>
                      <span className={`badge ${sub.status === 'Verified' ? 'badge-verified' : sub.status === 'Rejected' ? 'badge-rejected' : 'badge-pending'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => openReviewModal(sub)}
                        className="btn btn-secondary btn-sm"
                      >
                        <Eye size={13} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedSub && (
        <Modal
          isOpen={Boolean(selectedSub)}
          onClose={() => {
            setSelectedSub(null);
            setShowRejectInput(false);
          }}
          title={`Submission Proof Inspection: ${selectedSub.submission_id}`}
          maxWidth="750px"
        >
          <div>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--primary-400)', fontWeight: 700 }}>{selectedSub.hackathon_institution}</div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{selectedSub.hackathon_name}</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Submitted on {formatDate(selectedSub.created_at)} by <strong className="font-mono" style={{ color: '#ffffff' }}>{selectedSub.student_register_number}</strong>
                </div>
              </div>

              <span className={`badge ${selectedSub.status === 'Verified' ? 'badge-verified' : selectedSub.status === 'Rejected' ? 'badge-rejected' : 'badge-pending'}`} style={{ fontSize: '0.82rem' }}>
                {selectedSub.status}
              </span>
            </div>

            {/* Rejection Alert if rejected */}
            {selectedSub.status === 'Rejected' && selectedSub.rejection_reason && (
              <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
                <AlertCircle size={18} />
                <div>
                  <strong>Rejection Reason:</strong> {selectedSub.rejection_reason}
                </div>
              </div>
            )}

            {/* Team Breakdown */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Team Composition ({selectedSub.team_members?.length || 0} Members):
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {selectedSub.team_members?.map((m, i) => (
                  <div
                    key={m.id || i}
                    style={{
                      background: 'rgba(15, 23, 42, 0.7)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.88rem'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#ffffff' }}>{m.name}</strong>
                      <span className="font-mono text-muted" style={{ marginLeft: '0.5rem' }}>
                        {m.register_number ? `(${m.register_number})` : ''}
                      </span>
                      {m.department && <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>• {m.department} (Yr {m.year})</span>}
                      {m.institution && m.institution !== 'College' && <span style={{ color: 'var(--accent-amber)', marginLeft: '0.5rem' }}>• {m.institution}</span>}
                    </div>

                    <span className={`badge ${m.is_captain ? 'badge-college' : m.member_type === 'External' ? 'badge-external' : 'badge-college'}`} style={{ fontSize: '0.72rem' }}>
                      {m.is_captain ? '★ Captain' : m.member_type === 'External' ? 'External' : 'College Student'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Screenshot Viewer */}
            {selectedSub.screenshot_path && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Uploaded Proof Screenshot:
                  </div>
                  <a
                    href={
                      selectedSub.screenshot_path.startsWith('http://') ||
                      selectedSub.screenshot_path.startsWith('https://')
                        ? selectedSub.screenshot_path
                        : `/uploads/screenshots/${selectedSub.screenshot_path}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem', padding: '0.2rem 0.5rem' }}
                  >
                    <ExternalLink size={12} />
                    <span>Open Fullscreen</span>
                  </a>
                </div>

                <div
                  style={{
                    background: '#000',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    maxHeight: '360px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <img
                    src={
                      selectedSub.screenshot_path.startsWith('http://') ||
                      selectedSub.screenshot_path.startsWith('https://')
                        ? selectedSub.screenshot_path
                        : `/uploads/screenshots/${selectedSub.screenshot_path}`
                    }
                    alt="Registration Proof"
                    style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}

            {/* Rejection input box */}
            {showRejectInput && (
              <div style={{ marginBottom: '1.5rem', background: 'rgba(239, 68, 68, 0.08)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <label className="form-label" style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>
                  Reason for Rejection <span style={{ color: 'var(--accent-rose)' }}>*</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="e.g. Screenshot does not clearly show successful registration or team names."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
              {showRejectInput ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowRejectInput(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Back
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
