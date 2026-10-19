import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Modal from '../components/Modal';
import { api } from '../services/api';
import {
  FileCheck2,
  Calendar,
  Users,
  Eye,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Layers,
  ArrowLeft
} from 'lucide-react';

export default function MySubmissions() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected Submission Modal
  const [selectedSub, setSelectedSub] = useState(null);

  useEffect(() => {
    async function loadMySubmissions() {
      try {
        const res = await api.get('/submissions/my');
        if (res.success) {
          setSubmissions(res.submissions || []);
        }
      } catch (err) {
        setError(err.message || 'Failed to load your submissions.');
      } finally {
        setLoading(false);
      }
    }
    loadMySubmissions();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleOpenModal = async (sub) => {
    setSelectedSub(sub);
    try {
      const res = await api.get(`/submissions/${sub.id}`);
      if (res.success && res.submission) {
        setSelectedSub(res.submission);
      }
    } catch (e) {
      // keep basic info
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Verified':
        return (
          <span className="badge badge-verified">
            <CheckCircle2 size={13} /> Verified
          </span>
        );
      case 'Rejected':
        return (
          <span className="badge badge-rejected">
            <XCircle size={13} /> Rejected
          </span>
        );
      case 'Pending Review':
        return (
          <span className="badge badge-pending">
            <Clock size={13} /> Pending Review
          </span>
        );
      default:
        return (
          <span className="badge badge-pending">
            <Clock size={13} /> Pending Verification
          </span>
        );
    }
  };

  return (
    <>
      <Navbar />
      <div className="page-wrapper">
        <div className="container">
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              My Submissions
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
              Track the verification status of your uploaded hackathon proof submissions.
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
              <div>Loading your submissions...</div>
            </div>
          ) : error ? (
            <div className="alert alert-danger">{error}</div>
          ) : submissions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <FileCheck2 size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
              <h3>No Submissions Found</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                You haven't submitted registration proof for any hackathons yet.
              </p>
              <Link to="/hackathons" className="btn btn-primary">
                Browse Available Hackathons
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="card card-hover"
                  style={{
                    padding: '1.5rem',
                    borderLeft: `4px solid ${
                      sub.status === 'Verified'
                        ? 'var(--accent-emerald)'
                        : sub.status === 'Rejected'
                        ? 'var(--accent-rose)'
                        : 'var(--accent-amber)'
                    }`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
                        <span className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--brand-forest)' }}>
                          {sub.submission_id}
                        </span>
                        {getStatusBadge(sub.status)}
                      </div>

                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.35rem', color: 'var(--brand-navy)' }}>
                        {sub.hackathon_name}
                      </h3>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {sub.hackathon_institution}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {sub.status === 'Rejected' && (
                        <Link
                          to={`/hackathons/${sub.hackathon_id}`}
                          className="btn btn-primary btn-sm"
                        >
                          <Layers size={14} />
                          <span>Resubmit Proof</span>
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenModal(sub)}
                        className="btn btn-secondary btn-sm"
                      >
                        <Eye size={15} />
                        <span>View Details</span>
                      </button>
                    </div>
                  </div>

                  {/* If Rejected: Show reason box */}
                  {sub.status === 'Rejected' && sub.rejection_reason && (
                    <div
                      style={{
                        marginTop: '1.25rem',
                        background: '#FDF2F2',
                        border: '1px solid #f7c7c7',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.85rem 1.1rem',
                        fontSize: '0.88rem'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--accent-rose)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <AlertCircle size={15} />
                        <span>Reason for Rejection:</span>
                      </div>
                      <div style={{ color: 'var(--brand-navy)' }}>{sub.rejection_reason}</div>
                    </div>
                  )}

                  {/* If Pending Review after rejection: Show notice */}
                  {sub.status === 'Pending Review' && sub.previous_rejection_reason && (
                    <div
                      style={{
                        marginTop: '1.25rem',
                        background: 'var(--brand-pale-gold)',
                        border: '1px solid #f6deb2',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.85rem 1.1rem',
                        fontSize: '0.88rem'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#925c0e', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Clock size={15} />
                        <span>Corrected Submission Under Review</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        You resubmitted this proof following the administrator feedback: <em>"{sub.previous_rejection_reason}"</em>. Awaiting verification.
                      </div>
                    </div>
                  )}

                  {/* Submission Meta Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.5rem',
                      marginTop: '1.25rem',
                      paddingTop: '1rem',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '0.82rem',
                      color: 'var(--text-muted)',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div>Submitted: <strong style={{ color: 'var(--brand-navy)' }}>{formatDate(sub.created_at)}</strong></div>
                    <div>Team Size: <strong style={{ color: 'var(--brand-navy)' }}>{sub.team_size} Members</strong></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submission Detail Modal */}
      {selectedSub && (
        <Modal
          isOpen={Boolean(selectedSub)}
          onClose={() => setSelectedSub(null)}
          title={`Submission Details - ${selectedSub.submission_id}`}
        >
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--brand-forest)', fontWeight: 700 }}>
                {selectedSub.hackathon_institution}
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--brand-navy)' }}>{selectedSub.hackathon_name}</h3>
              <div style={{ marginTop: '0.5rem' }}>{getStatusBadge(selectedSub.status)}</div>
            </div>

            {selectedSub.status === 'Rejected' && selectedSub.rejection_reason && (
              <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
                <AlertCircle size={18} />
                <div>
                  <strong>Rejection Reason:</strong> {selectedSub.rejection_reason}
                </div>
              </div>
            )}

            {selectedSub.previous_rejection_reason && (selectedSub.status === 'Pending Review' || selectedSub.status === 'Pending') && (
              <div
                style={{
                  marginBottom: '1.25rem',
                  background: 'var(--brand-pale-gold)',
                  border: '1px solid #f6deb2',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1.1rem',
                  fontSize: '0.88rem'
                }}
              >
                <div style={{ fontWeight: 700, color: '#925c0e', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={15} />
                  <span>Corrected Resubmission Under Review</span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Prior rejection feedback: <span style={{ color: 'var(--brand-navy)', fontWeight: 600 }}>"{selectedSub.previous_rejection_reason}"</span>
                </div>
              </div>
            )}

            {/* Team Members List */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.65rem', color: 'var(--brand-navy)' }}>
                Registered Team Members ({selectedSub.team_members?.length || 0})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedSub.team_members?.map((m, i) => (
                  <div
                    key={m.id || i}
                    style={{
                      background: 'var(--brand-pale-green)',
                      border: '1px solid var(--border-subtle)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.88rem'
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--brand-navy)' }}>{m.name}</strong>
                      <span className="font-mono text-muted" style={{ marginLeft: '0.5rem' }}>
                        {m.register_number ? `(${m.register_number})` : ''}
                      </span>
                      {m.department && <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>• {m.department}</span>}
                    </div>

                    <span className={`badge ${m.is_captain ? 'badge-college' : m.member_type === 'External' ? 'badge-external' : 'badge-college'}`}>
                      {m.is_captain ? '★ Captain' : m.member_type === 'External' ? 'External' : 'College'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Proof Screenshot */}
            {selectedSub.screenshot_path && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--brand-navy)' }}>
                    Submitted Screenshot Proof
                  </h4>
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
                    background: '#ffffff',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    maxHeight: '350px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-subtle)',
                    padding: '0.5rem'
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
                    style={{ maxWidth: '100%', maxHeight: '340px', objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}

            {/* If Rejected: Action button to resubmit */}
            {selectedSub.status === 'Rejected' && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                <Link
                  to={`/hackathons/${selectedSub.hackathon_id}`}
                  className="btn btn-primary"
                >
                  <Layers size={16} />
                  <span>Resubmit Corrected Proof</span>
                </Link>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
