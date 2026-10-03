import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import FileUpload from '../components/FileUpload';
import { useStudentAuth } from '../context/StudentAuthContext';
import { api } from '../services/api';
import confetti from 'canvas-confetti';
import {
  Trophy,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  UserPlus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  FileCheck2,
  Loader2,
  Info
} from 'lucide-react';

export default function HackathonDetailSubmission() {
  const { id } = useParams();
  const { student } = useStudentAuth();
  const navigate = useNavigate();

  const [hackathon, setHackathon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Flow State
  const [hasCompletedExternalReg, setHasCompletedExternalReg] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState(null);

  // Team State
  const [teamSize, setTeamSize] = useState(1);
  const [members, setMembers] = useState([]);
  const [memberLookups, setMemberLookups] = useState({}); // index -> { loading, data, error }

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(null);

  useEffect(() => {
    async function loadHackathon() {
      try {
        const res = await api.get(`/hackathons/${id}`);
        if (res.success && res.hackathon) {
          const h = res.hackathon;
          setHackathon(h);

          // Initial team size set to minimum team size
          const initialSize = Math.max(h.min_team_size || 1, 1);
          setTeamSize(initialSize);

          // Setup initial members array with Captain as Member 1
          const initialMembers = [
            {
              registerNumber: student.registerNumber,
              name: student.name,
              department: student.department,
              year: student.year,
              section: student.section,
              memberType: 'College',
              institution: 'College',
              email: student.email,
              isCaptain: true
            }
          ];

          for (let i = 1; i < initialSize; i++) {
            initialMembers.push({
              registerNumber: '',
              name: '',
              department: '',
              year: '',
              section: '',
              memberType: 'College',
              institution: 'College',
              email: '',
              isCaptain: false
            });
          }

          setMembers(initialMembers);
        } else {
          setError('Hackathon not found.');
        }
      } catch (err) {
        setError(err.message || 'Failed to load hackathon.');
      } finally {
        setLoading(false);
      }
    }

    if (student) {
      loadHackathon();
    }
  }, [id, student]);

  // Adjust team members array when teamSize changes
  const handleTeamSizeChange = (newSize) => {
    if (!hackathon) return;
    const size = Math.max(hackathon.min_team_size, Math.min(hackathon.max_team_size, newSize));
    setTeamSize(size);

    setMembers((prev) => {
      const updated = [...prev];
      if (size > prev.length) {
        for (let i = prev.length; i < size; i++) {
          updated.push({
            registerNumber: '',
            name: '',
            department: '',
            year: '',
            section: '',
            memberType: 'College',
            institution: 'College',
            email: '',
            isCaptain: false
          });
        }
      } else if (size < prev.length) {
        return updated.slice(0, size);
      }
      return updated;
    });
  };

  // Member register number lookup
  const handleMemberRegChange = async (index, regNo) => {
    const trimmed = regNo.trim().toUpperCase();

    const updated = [...members];
    updated[index].registerNumber = trimmed;
    // Clear previous verified data until re-verified
    if (!trimmed) {
      updated[index].name = '';
      updated[index].department = '';
      updated[index].year = '';
      setMembers(updated);
      setMemberLookups((prev) => ({ ...prev, [index]: null }));
      return;
    }

    setMembers(updated);

    // Duplicate check
    const isDuplicate = members.some(
      (m, idx) => idx !== index && m.registerNumber && m.registerNumber.toUpperCase() === trimmed
    );

    if (isDuplicate) {
      setMemberLookups((prev) => ({
        ...prev,
        [index]: { error: 'This student is already part of the team.' }
      }));
      return;
    }

    // Lookup student
    setMemberLookups((prev) => ({ ...prev, [index]: { loading: true } }));

    try {
      const res = await api.post('/students/lookup', { registerNumber: trimmed });
      if (res.success && res.student) {
        const verifiedStudent = res.student;
        const currentMembers = [...members];
        currentMembers[index] = {
          ...currentMembers[index],
          name: verifiedStudent.name,
          department: verifiedStudent.department,
          year: verifiedStudent.year,
          section: verifiedStudent.section,
          email: verifiedStudent.email
        };
        setMembers(currentMembers);
        setMemberLookups((prev) => ({ ...prev, [index]: { data: verifiedStudent } }));
      }
    } catch (err) {
      setMemberLookups((prev) => ({
        ...prev,
        [index]: { error: 'This register number is not in the approved student list.' }
      }));
    }
  };

  // Toggle member type between College and External
  const handleToggleMemberType = (index, type) => {
    const updated = [...members];
    updated[index] = {
      registerNumber: '',
      name: '',
      department: '',
      year: '',
      section: '',
      memberType: type,
      institution: type === 'College' ? 'College' : '',
      email: '',
      isCaptain: false
    };
    setMembers(updated);
    setMemberLookups((prev) => ({ ...prev, [index]: null }));
  };

  // Update external member fields
  const handleExternalFieldChange = (index, field, value) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  // Final Submission
  const handleSubmitProof = async (e) => {
    e.preventDefault();
    setError(null);

    if (!screenshotFile) {
      setError('Please upload your registration proof screenshot before submitting.');
      return;
    }

    // Validate college members
    for (let i = 1; i < members.length; i++) {
      const m = members[i];
      if (m.memberType === 'College') {
        if (!m.registerNumber || !m.name) {
          setError(`Please enter and verify a valid Register Number for Member ${i + 1}.`);
          return;
        }
      } else if (m.memberType === 'External') {
        if (!m.name || !m.institution) {
          setError(`Please provide Full Name and Institution for External Member ${i + 1}.`);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('hackathonId', id);
      formData.append('screenshot', screenshotFile);
      formData.append('membersData', JSON.stringify(members));

      const res = await api.post('/submissions', formData);

      if (res.success) {
        setSubmissionSuccess(res);
        // Trigger celebratory confetti
        try {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          });
        } catch (e) {}
      }
    } catch (err) {
      setError(err.message || 'Failed to submit registration proof. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-muted)' }}>
          <div>Loading hackathon details...</div>
        </div>
      </>
    );
  }

  if (error && !hackathon) {
    return (
      <>
        <Navbar />
        <div className="container" style={{ padding: '3rem 0' }}>
          <div className="alert alert-danger">{error}</div>
          <Link to="/hackathons" className="btn btn-secondary">
            <ArrowLeft size={16} /> Back to Hackathons
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page-wrapper">
        <div className="container" style={{ maxWidth: '900px' }}>
          {/* Back link */}
          <div style={{ marginBottom: '1.5rem' }}>
            <Link to="/hackathons" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <ArrowLeft size={16} /> Back to Available Hackathons
            </Link>
          </div>

          {/* Success Screen */}
          {submissionSuccess ? (
            <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: 'var(--accent-emerald)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                  boxShadow: '0 0 30px rgba(16, 185, 129, 0.25)'
                }}
              >
                <CheckCircle2 size={42} />
              </div>

              <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.5rem' }}>
                Registration Submitted Successfully
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '2rem' }}>
                Your registration proof has been submitted successfully and sent for administrative verification.
              </p>

              {/* Submission Details Box */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.75rem',
                  maxWidth: '460px',
                  margin: '0 auto 2.5rem',
                  textAlign: 'left'
                }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                    Submission ID
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary-400)' }}>
                    {submissionSuccess.submissionId}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                      Status
                    </div>
                    <div style={{ marginTop: '0.25rem' }}>
                      <span className="badge badge-pending">
                        {submissionSuccess.status || 'Pending Verification'}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                      Team Size
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', marginTop: '0.25rem' }}>
                      {submissionSuccess.teamSize} Members
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <Link to="/my-submissions" className="btn btn-primary btn-lg">
                  <FileCheck2 size={18} />
                  <span>View My Submissions</span>
                </Link>
                <Link to="/hackathons" className="btn btn-secondary btn-lg">
                  <span>Browse More Hackathons</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Hackathon Overview Banner */}
              <div className="card" style={{ marginBottom: '2rem', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--primary-400)', fontWeight: 700, marginBottom: '0.35rem' }}>
                      {hackathon.institution}
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                      {hackathon.name}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', maxWidth: '650px', lineHeight: 1.6 }}>
                      {hackathon.description}
                    </p>
                  </div>

                  <span className="badge badge-college" style={{ fontSize: '0.85rem' }}>
                    {hackathon.mode}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginTop: '1.5rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <Calendar size={16} color="var(--primary-400)" />
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem', display: 'block' }}>DATES</span>
                      <strong>{formatDate(hackathon.start_date)} – {formatDate(hackathon.end_date)}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <Clock size={16} color="var(--accent-amber)" />
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem', display: 'block' }}>REGISTRATION DEADLINE</span>
                      <strong>{formatDate(hackathon.registration_deadline)}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <Users size={16} color="var(--accent-cyan)" />
                    <div>
                      <span className="text-muted" style={{ fontSize: '0.78rem', display: 'block' }}>REQUIRED TEAM SIZE</span>
                      <strong>{hackathon.min_team_size}–{hackathon.max_team_size} Members</strong>
                    </div>
                  </div>
                </div>

                {/* External Registration Action Card */}
                <div
                  style={{
                    marginTop: '1.75rem',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#ffffff' }}>
                      Step 1: Complete Registration on Official Portal
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Register on the external portal, save your confirmation screenshot, then return here.
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <a
                      href={hackathon.registration_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline"
                    >
                      <span>REGISTER NOW</span>
                      <ExternalLink size={15} />
                    </a>

                    {!hasCompletedExternalReg ? (
                      <button
                        type="button"
                        onClick={() => setHasCompletedExternalReg(true)}
                        className="btn btn-primary"
                      >
                        <CheckCircle2 size={16} />
                        <span>I HAVE COMPLETED REGISTRATION</span>
                      </button>
                    ) : (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          color: 'var(--accent-emerald)',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          padding: '0.5rem 0.85rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        <CheckCircle2 size={16} />
                        <span>Registration Step Completed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2 & 3: Proof Upload & Team Details */}
              {hasCompletedExternalReg && (
                <form onSubmit={handleSubmitProof}>
                  {/* Proof Upload Card */}
                  <div className="card" style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.35rem' }}>
                      Upload Registration Proof
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                      Upload a screenshot showing that you have successfully registered for this hackathon.
                    </p>

                    <FileUpload
                      file={screenshotFile}
                      onFileSelect={(file) => setScreenshotFile(file)}
                      onFileRemove={() => setScreenshotFile(null)}
                      label="Registration Confirmation Screenshot"
                    />
                  </div>

                  {/* Team Details Card */}
                  <div className="card" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                          Team Details
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                          Configure your team composition ({hackathon.min_team_size} to {hackathon.max_team_size} members).
                        </p>
                      </div>

                      {/* Team Size Selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                          Team Size:
                        </label>
                        <select
                          className="form-select"
                          value={teamSize}
                          onChange={(e) => handleTeamSizeChange(parseInt(e.target.value, 10))}
                          style={{ width: 'auto', padding: '0.45rem 1rem', fontWeight: 700 }}
                        >
                          {Array.from(
                            { length: hackathon.max_team_size - hackathon.min_team_size + 1 },
                            (_, i) => hackathon.min_team_size + i
                          ).map((num) => (
                            <option key={num} value={num}>
                              {num} Members
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Member List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {members.map((member, idx) => {
                        const isCaptain = idx === 0;
                        const lookup = memberLookups[idx];

                        return (
                          <div
                            key={idx}
                            style={{
                              background: isCaptain ? 'rgba(99, 102, 241, 0.08)' : 'rgba(15, 23, 42, 0.6)',
                              border: `1px solid ${isCaptain ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-subtle)'}`,
                              borderRadius: 'var(--radius-lg)',
                              padding: '1.25rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#ffffff' }}>
                                  Member {idx + 1}
                                </span>
                                {isCaptain ? (
                                  <span className="badge badge-college">
                                    ★ Team Captain
                                  </span>
                                ) : (
                                  <span className={`badge ${member.memberType === 'External' ? 'badge-external' : 'badge-college'}`}>
                                    {member.memberType === 'External' ? 'External Participant' : 'College Student'}
                                  </span>
                                )}
                              </div>

                              {/* Toggle College / External Member if allowed and not captain */}
                              {!isCaptain && hackathon.allow_external_participants && (
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleMemberType(idx, 'College')}
                                    className={`btn btn-sm ${member.memberType === 'College' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}
                                  >
                                    College Student
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleMemberType(idx, 'External')}
                                    className={`btn btn-sm ${member.memberType === 'External' ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ fontSize: '0.78rem', padding: '0.25rem 0.65rem' }}
                                  >
                                    External Member
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Captain Row (Read-only) */}
                            {isCaptain ? (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                                  gap: '0.75rem',
                                  fontSize: '0.88rem'
                                }}
                              >
                                <div>
                                  <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>REGISTER NUMBER</span>
                                  <span className="font-mono" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{student.registerNumber}</span>
                                </div>
                                <div>
                                  <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>STUDENT NAME</span>
                                  <strong style={{ color: 'var(--text-primary)' }}>{student.name}</strong>
                                </div>
                                <div>
                                  <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>DEPARTMENT / YEAR</span>
                                  <span>{student.department} (Year {student.year})</span>
                                </div>
                                <div>
                                  <span className="text-muted" style={{ fontSize: '0.75rem', display: 'block' }}>STATUS</span>
                                  <span style={{ color: 'var(--accent-emerald)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <CheckCircle2 size={14} /> Verified Captain
                                  </span>
                                </div>
                              </div>
                            ) : member.memberType === 'College' ? (
                              /* College Member Form */
                              <div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) 1fr', gap: '1rem', alignItems: 'flex-start' }}>
                                  <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem' }}>
                                      Register Number <span style={{ color: 'var(--accent-rose)' }}>*</span>
                                    </label>
                                    <input
                                      type="text"
                                      className="form-input"
                                      placeholder="e.g. 1301"
                                      value={member.registerNumber}
                                      onChange={(e) => handleMemberRegChange(idx, e.target.value)}
                                      style={{ padding: '0.6rem 0.85rem' }}
                                    />
                                  </div>

                                  {/* Live Verification Badge / Info */}
                                  <div>
                                    {lookup?.loading ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-400)', fontSize: '0.85rem', paddingTop: '1.75rem' }}>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Verifying register number...</span>
                                      </div>
                                    ) : lookup?.data || member.name ? (
                                      <div
                                        style={{
                                          background: 'rgba(16, 185, 129, 0.08)',
                                          border: '1px solid rgba(16, 185, 129, 0.3)',
                                          borderRadius: 'var(--radius-md)',
                                          padding: '0.65rem 1rem',
                                          marginTop: '0.25rem'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-emerald)', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                                          <CheckCircle2 size={15} />
                                          <span>Verified College Student</span>
                                        </div>
                                        <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                          <strong>{member.name}</strong> • {member.department} (Year {member.year})
                                        </div>
                                      </div>
                                    ) : lookup?.error ? (
                                      <div className="error-text" style={{ paddingTop: '1.75rem' }}>
                                        <AlertCircle size={15} />
                                        <span>{lookup.error}</span>
                                      </div>
                                    ) : (
                                      <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', paddingTop: '1.75rem' }}>
                                        Enter register number to auto-verify approved student
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* External Member Form */
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontSize: '0.82rem' }}>
                                    Full Name <span style={{ color: 'var(--accent-rose)' }}>*</span>
                                  </label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    placeholder="External student full name"
                                    value={member.name}
                                    onChange={(e) => handleExternalFieldChange(idx, 'name', e.target.value)}
                                    style={{ padding: '0.6rem 0.85rem' }}
                                  />
                                </div>

                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontSize: '0.82rem' }}>
                                    Institution / College <span style={{ color: 'var(--accent-rose)' }}>*</span>
                                  </label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. ABC Engineering College"
                                    value={member.institution}
                                    onChange={(e) => handleExternalFieldChange(idx, 'institution', e.target.value)}
                                    style={{ padding: '0.6rem 0.85rem' }}
                                  />
                                </div>

                                <div className="form-group" style={{ margin: 0 }}>
                                  <label className="form-label" style={{ fontSize: '0.82rem' }}>
                                    Student ID / Reg No (optional)
                                  </label>
                                  <input
                                    type="text"
                                    className="form-input"
                                    placeholder="External ID"
                                    value={member.registerNumber}
                                    onChange={(e) => handleExternalFieldChange(idx, 'registerNumber', e.target.value)}
                                    style={{ padding: '0.6rem 0.85rem' }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submission Summary Box */}
                  <div className="card" style={{ marginBottom: '2rem', border: '1px solid var(--primary-500)' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sparkles size={18} color="var(--primary-400)" />
                      <span>Submission Summary</span>
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                      <div>
                        <span className="text-muted" style={{ fontSize: '0.78rem', display: 'block' }}>HACKATHON</span>
                        <strong>{hackathon.name}</strong>
                      </div>
                      <div>
                        <span className="text-muted" style={{ fontSize: '0.78rem', display: 'block' }}>SUBMITTING CAPTAIN</span>
                        <strong>{student.name} ({student.registerNumber})</strong>
                      </div>
                      <div>
                        <span className="text-muted" style={{ fontSize: '0.78rem', display: 'block' }}>TOTAL TEAM SIZE</span>
                        <strong>{teamSize} Members</strong>
                      </div>
                      <div>
                        <span className="text-muted" style={{ fontSize: '0.78rem', display: 'block' }}>SCREENSHOT ATTACHED</span>
                        <span style={{ color: screenshotFile ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 600 }}>
                          {screenshotFile ? `✓ ${screenshotFile.name}` : '❌ Not Uploaded'}
                        </span>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(15, 23, 42, 0.7)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1.1rem', fontSize: '0.85rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Team Members List:</div>
                      <ol style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {members.map((m, i) => (
                          <li key={i}>
                            <strong>{m.registerNumber || '(Ext)'}</strong> - {m.name || 'Pending Entry'} {m.institution && m.institution !== 'College' ? `(${m.institution})` : ''} - <span style={{ color: m.isCaptain ? 'var(--primary-400)' : m.memberType === 'External' ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>{m.isCaptain ? 'Team Captain' : m.memberType === 'External' ? 'External Participant' : 'College Student'}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  {error && (
                    <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
                      <AlertCircle size={20} />
                      <div>{error}</div>
                    </div>
                  )}

                  {/* Submit Proof Button */}
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg btn-block"
                    disabled={submitting || !screenshotFile}
                    style={{ fontSize: '1.1rem', padding: '1rem 2rem' }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>Submitting Registration Proof...</span>
                      </>
                    ) : (
                      <>
                        <span>SUBMIT REGISTRATION PROOF</span>
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
