import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Modal from '../components/Modal';
import { Users2, Search, Filter, Eye, CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';

export default function AdminTeams() {
  const [teams, setTeams] = useState([]);
  const [hackathons, setHackathons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [hackathonFilter, setHackathonFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);

  useEffect(() => {
    loadTeams();
    loadHackathons();
  }, []);

  async function loadHackathons() {
    try {
      const res = await api.get('/hackathons/admin/all');
      if (res.success) setHackathons(res.hackathons || []);
    } catch (e) {}
  }

  async function loadTeams() {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (hackathonFilter !== 'All') queryParams.append('hackathonId', hackathonFilter);
      if (search) queryParams.append('search', search);

      const res = await api.get(`/submissions/admin/teams/all?${queryParams.toString()}`);
      if (res.success) {
        setTeams(res.teams || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load teams.');
    } finally {
      setLoading(false);
    }
  }

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    loadTeams();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Team Management</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Explore registered student teams, captain information, and college vs external member distributions.
        </p>
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <form onSubmit={handleFilterSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Search Captain / Member / Submission ID:</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Arjun, 1300, SUB-2026..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
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
            <span>Search Teams</span>
          </button>
        </form>
      </div>

      {/* Teams Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            All Registered Teams ({teams.length})
          </h2>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            <div>Loading teams...</div>
          </div>
        ) : error ? (
          <div className="alert alert-danger" style={{ margin: '1.5rem' }}>{error}</div>
        ) : teams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
            No registered teams found.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Team ID</th>
                  <th>Hackathon</th>
                  <th>Captain</th>
                  <th>Total Size</th>
                  <th>College Members</th>
                  <th>External Members</th>
                  <th>Submission Status</th>
                  <th style={{ textAlign: 'right' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.team_id}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--primary-400)' }}>
                      T-{String(t.team_id).padStart(4, '0')}
                    </td>
                    <td style={{ fontWeight: 600 }}>{t.hackathon_name}</td>
                    <td>
                      <strong>{t.captain?.name || 'Captain'}</strong>
                      {t.captain?.register_number && (
                        <div className="font-mono text-muted" style={{ fontSize: '0.8rem' }}>
                          {t.captain.register_number}
                        </div>
                      )}
                    </td>
                    <td>{t.team_size} Members</td>
                    <td>
                      <span className="badge badge-college">{t.college_count} College</span>
                    </td>
                    <td>
                      <span className={`badge ${t.external_count > 0 ? 'badge-external' : 'badge-inactive'}`}>
                        {t.external_count} External
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${t.submission_status === 'Verified' ? 'badge-verified' : t.submission_status === 'Rejected' ? 'badge-rejected' : 'badge-pending'}`}>
                        {t.submission_status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedTeam(t)}
                        className="btn btn-secondary btn-sm"
                      >
                        <Eye size={13} />
                        <span>View Team</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Team Detail Modal */}
      {selectedTeam && (
        <Modal
          isOpen={Boolean(selectedTeam)}
          onClose={() => setSelectedTeam(null)}
          title={`Team Details: T-${String(selectedTeam.team_id).padStart(4, '0')}`}
        >
          <div>
            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{selectedTeam.hackathon_name}</h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Submission ID: <span className="font-mono text-primary" style={{ fontWeight: 700 }}>{selectedTeam.submission_id}</span> • Status: <span className={`badge ${selectedTeam.submission_status === 'Verified' ? 'badge-verified' : selectedTeam.submission_status === 'Rejected' ? 'badge-rejected' : 'badge-pending'}`}>{selectedTeam.submission_status}</span>
              </div>
            </div>

            {/* Members Roster */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                Team Members ({selectedTeam.members?.length || 0}):
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedTeam.members?.map((m, i) => (
                  <div
                    key={m.id || i}
                    style={{
                      background: 'rgba(15, 23, 42, 0.7)',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.88rem'
                    }}
                  >
                    <div>
                      <strong style={{ color: '#ffffff' }}>{m.name}</strong>
                      {m.register_number && (
                        <span className="font-mono text-muted" style={{ marginLeft: '0.5rem' }}>
                          ({m.register_number})
                        </span>
                      )}
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {m.member_type === 'College' ? `${m.department || 'CSE'} • Year ${m.year || '2'}` : m.institution}
                      </div>
                    </div>

                    <span className={`badge ${m.is_captain ? 'badge-college' : m.member_type === 'External' ? 'badge-external' : 'badge-college'}`}>
                      {m.is_captain ? '★ Team Captain' : m.member_type === 'External' ? 'External' : 'College Student'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
