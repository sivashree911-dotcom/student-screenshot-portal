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
  ChevronRight,
  Sparkles,
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
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                color: 'var(--brand-forest)',
                background: 'var(--brand-sage-light)',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '0.75rem',
                border: '1px solid #c9dcd0'
              }}
            >
              <Sparkles size={14} />
              <span>COLLEGE HACKATHON DIRECTORY</span>
            </div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--brand-navy)' }}>
              Available Hackathons
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.02rem', maxWidth: '650px', lineHeight: 1.6 }}>
              Select a hackathon below to register on the official website, upload your registration proof screenshot, and register your team members.
            </p>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--brand-forest)' }}>Loading active hackathons...</div>
            </div>
          ) : error ? (
            <div className="alert alert-danger">
              <AlertCircle size={20} />
              <div>{error}</div>
            </div>
          ) : hackathons.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <Trophy size={48} style={{ color: 'var(--brand-sage)', margin: '0 auto 1rem' }} />
              <h3 style={{ color: 'var(--brand-navy)' }}>No Active Hackathons Available</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                There are currently no active hackathons open for submission. Please check back later.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
                gap: '1.75rem'
              }}
            >
              {hackathons.map((h) => {
                const posterUrl = h.poster_path
                  ? h.poster_path.startsWith('http://') || h.poster_path.startsWith('https://')
                    ? h.poster_path
                    : `/uploads/posters/${h.poster_path}`
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
                        background: 'linear-gradient(135deg, #E8F0EB 0%, #d4e5db 100%)',
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
                        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--brand-forest)' }}>
                          <Trophy size={40} style={{ margin: '0 auto 0.5rem' }} />
                          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{h.institution}</div>
                        </div>
                      )}

                      <div
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: 'rgba(255, 255, 255, 0.92)',
                          backdropFilter: 'blur(8px)',
                          padding: '0.3rem 0.65rem',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          color: 'var(--brand-forest-dark)',
                          border: '1px solid var(--border-subtle)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                        }}
                      >
                        {h.mode}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--brand-forest)', fontWeight: 700, marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {h.institution}
                      </div>

                      <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.65rem', lineHeight: 1.3, color: 'var(--brand-navy)' }}>
                        {h.name}
                      </h3>

                      <p
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.9rem',
                          lineHeight: 1.55,
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
                          gap: '0.55rem',
                          background: 'var(--brand-pale-green)',
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.84rem',
                          marginBottom: '1.5rem',
                          border: '1px solid var(--border-subtle)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--text-secondary)' }}>
                          <Calendar size={15} style={{ color: 'var(--brand-forest)', flexShrink: 0 }} />
                          <span>Dates: <strong style={{ color: 'var(--brand-navy)' }}>{formatDate(h.start_date)} – {formatDate(h.end_date)}</strong></span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--text-secondary)' }}>
                          <Clock size={15} style={{ color: 'var(--brand-soft-gold)', flexShrink: 0 }} />
                          <span>Deadline: <strong style={{ color: 'var(--brand-navy)' }}>{formatDate(h.registration_deadline)}</strong></span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--text-secondary)' }}>
                          <Users size={15} style={{ color: 'var(--brand-forest)', flexShrink: 0 }} />
                          <span>Team Size: <strong style={{ color: 'var(--brand-navy)' }}>{h.min_team_size}–{h.max_team_size} Members</strong></span>
                        </div>

                        {h.location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--text-secondary)' }}>
                            <MapPin size={15} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
                            <span>Location: <strong style={{ color: 'var(--brand-navy)' }}>{h.location}</strong></span>
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
