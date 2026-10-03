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
                        <span className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary-400)' }}>
                          {sub.submission_id}
                        </span>
                        {getStatusBadge(sub.status)}
                      </div>

                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                        {sub.hackathon_name}
                      </h3>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {sub.hackathon_institution}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedSub(sub)}
                      className="btn btn-secondary btn-sm"
                    >
                      <Eye size={15} />
                      <span>View Details</span>
                    </button>
                  </div>

                  {/* If Rejected: Show reason box */}
                  {sub.status === 'Rejected' && sub.rejection_reason && (
                    <div
                      style={{
                        marginTop: '1.25rem',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.85rem 1.1rem',
                        fontSize: '0.88rem'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--accent-rose)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <AlertCircle size={15} />
                        <span>Reason for Rejection:</span>
                      </div>
                      <div style={{ color: '#fecaca' }}>{sub.rejection_reason}</div>
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
                    <div>Submitted: <strong style={{ color: 'var(--text-secondary)' }}>{formatDate(sub.created_at)}</strong></div>
                    <div>Team Size: <strong style={{ color: 'var(--text-secondary)' }}>{sub.team_size} Members</strong></div>
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
              <div style={{ fontSize: '0.82rem', color: 'var(--primary-400)', fontWeight: 700 }}>
                {selectedSub.hackathon_institution}
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{selectedSub.hackathon_name}</h3>
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

            {/* Team Members List */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.65rem' }}>
                Registered Team Members ({selectedSub.team_members?.length || 0})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.65rem' }}>
                  Submitted Screenshot Proof
                </h4>
                <div
                  style={{
                    background: '#000',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    maxHeight: '350px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <img
                    src={`/uploads/screenshots/${selectedSub.screenshot_path}`}
                    alt="Registration Proof"
                    style={{ maxWidth: '100%', maxHeight: '350px', objectFit: 'contain' }}
                  />
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
