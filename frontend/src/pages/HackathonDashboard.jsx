import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { api } from '../services/api';
import {
  Trophy,
  Calendar,
  Clock,
  Users,
  MapPin,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Layers,
  AlertCircle
} from 'lucide-react';

export default function HackathonDashboard() {
  const [hackathons, setHackathons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadHackathons() {
      try {
        const res = await api.get('/hackathons');
        if (res.success) {
          setHackathons(res.hackathons || []);
        }
      } catch (err) {
        setError(err.message || 'Failed to load hackathons.');
      } finally {
        setLoading(false);
      }
    }
    loadHackathons();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <>
      <Navbar />
      <div className="page-wrapper">
        <div className="container">
          {/* Header Banner */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-400)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
              <Sparkles size={16} />
              <span>COLLEGE HACKATHON DIRECTORY</span>
            </div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
              Available Hackathons
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '650px' }}>
              Select a hackathon below to register on the official website, upload your registration proof screenshot, and register your team members.
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>Loading active hackathons...</div>
            </div>
          ) : error ? (
            <div className="alert alert-danger">
              <AlertCircle size={20} />
              <div>{error}</div>
            </div>
          ) : hackathons.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <Trophy size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
              <h3>No Active Hackathons Available</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                There are currently no active hackathons open for submission. Please check back later.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                gap: '1.75rem'
              }}
            >
              {hackathons.map((h) => {
                const posterUrl = h.poster_path
                  ? `/uploads/posters/${h.poster_path}`
                  : null;

                return (
                  <div
                    key={h.id}
                    className="card card-hover"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: 0,
                      overflow: 'hidden',
                      borderRadius: 'var(--radius-xl)'
                    }}
                  >
                    {/* Poster Section */}
                    <div
                      style={{
                        height: '190px',
                        background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}
                    >
                      {posterUrl ? (
                        <img
                          src={posterUrl}
                          alt={h.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,0.7)' }}>
                          <Trophy size={40} style={{ margin: '0 auto 0.5rem' }} />
                          <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{h.institution}</div>
                        </div>
                      )}

                      <div
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: 'rgba(0, 0, 0, 0.65)',
                          backdropFilter: 'blur(8px)',
                          padding: '0.3rem 0.65rem',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.15)'
                        }}
                      >
                        {h.mode}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--primary-400)', fontWeight: 700, marginBottom: '0.35rem' }}>
                        {h.institution}
                      </div>

                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.75rem', lineHeight: 1.3 }}>
                        {h.name}
                      </h3>

                      <p
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.88rem',
                          lineHeight: 1.5,
                          marginBottom: '1.25rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {h.description}
                      </p>

                      {/* Hackathon Specs */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem',
                          background: 'rgba(15, 23, 42, 0.5)',
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.84rem',
                          marginBottom: '1.5rem',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                          <Calendar size={15} style={{ color: 'var(--primary-400)' }} />
                          <span>Dates: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(h.start_date)} – {formatDate(h.end_date)}</strong></span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                          <Clock size={15} style={{ color: 'var(--accent-amber)' }} />
                          <span>Deadline: <strong style={{ color: 'var(--text-primary)' }}>{formatDate(h.registration_deadline)}</strong></span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                          <Users size={15} style={{ color: 'var(--accent-cyan)' }} />
                          <span>Team Size: <strong style={{ color: 'var(--text-primary)' }}>{h.min_team_size}–{h.max_team_size} Members</strong></span>
                        </div>

                        {h.location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                            <MapPin size={15} style={{ color: 'var(--accent-rose)' }} />
                            <span>Location: <strong style={{ color: 'var(--text-primary)' }}>{h.location}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div style={{ marginTop: 'auto' }}>
                        <Link
                          to={`/hackathons/${h.id}`}
                          className="btn btn-primary btn-block"
                          style={{ gap: '0.5rem' }}
                        >
                          <span>REGISTER / SUBMIT PROOF</span>
                          <ChevronRight size={16} />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
