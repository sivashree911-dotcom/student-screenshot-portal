import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import {
  PieChart,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Search,
  Filter,
  Layers,
  Loader2,
  TrendingUp
} from 'lucide-react';

export default function AdminParticipation() {
  const [searchParams] = useSearchParams();
  const initialHackId = searchParams.get('hackathonId');

  const [hackathons, setHackathons] = useState([]);
  const [selectedHackathonId, setSelectedHackathonId] = useState(initialHackId || '');
  const [participationData, setParticipationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Tab State: 'participated' | 'not_participated' | 'duplicates'
  const [activeTab, setActiveTab] = useState('participated');

  // Search & Filter within lists
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');

  useEffect(() => {
    loadHackathonsList();
  }, []);

  useEffect(() => {
    if (selectedHackathonId) {
      loadParticipationStats(selectedHackathonId);
    }
  }, [selectedHackathonId]);

  async function loadHackathonsList() {
    try {
      const res = await api.get('/hackathons/admin/all');
      if (res.success && res.hackathons && res.hackathons.length > 0) {
        setHackathons(res.hackathons);
        if (!selectedHackathonId) {
          setSelectedHackathonId(res.hackathons[0].id);
        }
      }
    } catch (e) {
      setError('Failed to load hackathons.');
    }
  }

  async function loadParticipationStats(hackId) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/participation/hackathon/${hackId}`);
      if (res.success) {
        setParticipationData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to calculate participation statistics.');
    } finally {
      setLoading(false);
    }
  }

  const handleExportCsv = async () => {
    if (!selectedHackathonId) return;
    const hackName = participationData?.hackathon?.name || 'hackathon';
    const filename = `participation_${hackName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`;
    await api.downloadCsv(`/participation/hackathon/${selectedHackathonId}/export-csv`, filename);
  };

  const summary = participationData?.summary || {};
  const duplicateList = participationData?.duplicateParticipations || [];

  // Filtered lists
  const participatedList = (participationData?.participatedStudents || []).filter((s) => {
    const matchSearch =
      !searchTerm ||
      s.registerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = deptFilter === 'All' || s.department === deptFilter;
    return matchSearch && matchDept;
  });

  const notParticipatedList = (participationData?.notParticipatedStudents || []).filter((s) => {
    const matchSearch =
      !searchTerm ||
      s.registerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchDept = deptFilter === 'All' || s.department === deptFilter;
    return matchSearch && matchDept;
  });

  return (
    <div>
      {/* Header & Hackathon Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Hackathon Participation Tracking</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Calculated strictly based on unique approved college students in verified team submissions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            value={selectedHackathonId}
            onChange={(e) => setSelectedHackathonId(e.target.value)}
            style={{ width: 'auto', minWidth: '260px', fontWeight: 700 }}
          >
            {hackathons.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleExportCsv}
            className="btn btn-secondary"
            disabled={loading || !participationData}
          >
            <Download size={15} />
            <span>Export CSV Report</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
          <div>Calculating dynamic participation metrics...</div>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <>
          {/* Duplicate Participation Warning Banner */}
          {duplicateList.length > 0 && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.25rem',
                marginBottom: '1.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-amber)', fontWeight: 800, fontSize: '1rem', marginBottom: '0.5rem' }}>
                <AlertTriangle size={18} />
                <span>⚠ Duplicate Participation Detected ({duplicateList.length} Students)</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.85rem' }}>
                The following students appear in multiple teams for this same hackathon. They are counted as 1 distinct participating student, but the duplicate registrations are flagged below:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {duplicateList.map((dup, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}
                  >
                    <div>
                      <strong className="font-mono text-primary">{dup.registerNumber}</strong> - {dup.studentName}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-amber)' }}>
                      Appears in {dup.occurrenceCount} teams ({dup.submissions.map(s => `Team T-${String(s.teamId).padStart(4, '0')} [${s.status}]`).join(', ')})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Total Approved Students</div>
              <div className="stat-value">{summary.totalStudents || 0}</div>
              <div className="stat-meta">Google Sheet / Registry Roster</div>
            </div>

            <div className="stat-card stat-emerald">
              <div className="stat-label">Participated Students</div>
              <div className="stat-value" style={{ color: 'var(--accent-emerald)' }}>{summary.participatedCount || 0}</div>
              <div className="stat-meta">Verified in Confirmed Teams</div>
            </div>

            <div className="stat-card stat-rose">
              <div className="stat-label">Not Participated</div>
              <div className="stat-value" style={{ color: 'var(--accent-rose)' }}>{summary.notParticipatedCount || 0}</div>
              <div className="stat-meta">Unregistered Approved Students</div>
            </div>

            <div className="stat-card stat-cyan">
              <div className="stat-label">Participation Rate</div>
              <div className="stat-value" style={{ color: 'var(--accent-cyan)' }}>{summary.participationRate || 0}%</div>
              <div className="stat-meta">Overall College Turnout</div>
            </div>
          </div>

          {/* Tab Navigation and Search */}
          <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('participated')}
                  className={`btn btn-sm ${activeTab === 'participated' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ gap: '0.4rem' }}
                >
                  <CheckCircle2 size={14} />
                  <span>Participated List ({summary.participatedCount || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('not_participated')}
                  className={`btn btn-sm ${activeTab === 'not_participated' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ gap: '0.4rem' }}
                >
                  <XCircle size={14} />
                  <span>Not Participated ({summary.notParticipatedCount || 0})</span>
                </button>
              </div>

              {/* In-table Search and Dept Filter */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Filter name or reg no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '200px', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                />

                <select
                  className="form-select"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                >
                  <option value="All">All Departments</option>
                  <option value="CSE">CSE</option>
                  <option value="IT">IT</option>
                  <option value="ECE">ECE</option>
                  <option value="AI & DS">AI & DS</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Area */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {activeTab === 'participated' ? (
              <div>
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(16, 185, 129, 0.05)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-emerald)' }}>
                    ✓ Confirmed Participating Students ({participatedList.length})
                  </h3>
                </div>

                <div className="table-responsive">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Register Number</th>
                        <th>Student Name</th>
                        <th>Department</th>
                        <th>Year</th>
                        <th>Role</th>
                        <th>Submission ID</th>
                        <th>Team ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participatedList.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                            No participating students found for this hackathon.
                          </td>
                        </tr>
                      ) : (
                        participatedList.map((st, i) => (
                          <tr key={st.registerNumber || i}>
                            <td className="font-mono" style={{ fontWeight: 700, color: 'var(--primary-400)' }}>
                              {st.registerNumber}
                            </td>
                            <td style={{ fontWeight: 600 }}>{st.name}</td>
                            <td><span className="badge badge-college">{st.department}</span></td>
                            <td>Year {st.year}</td>
                            <td>
                              <span className={`badge ${st.isCaptain ? 'badge-college' : 'badge-active'}`}>
                                {st.isCaptain ? '★ Captain' : 'Team Member'}
                              </span>
                            </td>
                            <td className="font-mono text-muted">{st.submissionId}</td>
                            <td className="font-mono text-muted">T-{String(st.teamId).padStart(4, '0')}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(239, 68, 68, 0.05)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-rose)' }}>
                    ❌ Students Who Have Not Participated ({notParticipatedList.length})
                  </h3>
                </div>

                <div className="table-responsive">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>Register Number</th>
                        <th>Student Name</th>
                        <th>Department</th>
                        <th>Year</th>
                        <th>Section</th>
                        <th>Email</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notParticipatedList.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                            All approved students are participating in this hackathon!
                          </td>
                        </tr>
                      ) : (
                        notParticipatedList.map((st, i) => (
                          <tr key={st.registerNumber || i}>
                            <td className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-rose)' }}>
                              {st.registerNumber}
                            </td>
                            <td style={{ fontWeight: 600 }}>{st.name}</td>
                            <td><span className="badge badge-college">{st.department}</span></td>
                            <td>Year {st.year}</td>
                            <td>Sec {st.section || 'A'}</td>
                            <td className="font-mono text-muted" style={{ fontSize: '0.84rem' }}>{st.email || '-'}</td>
                            <td>
                              <span className="badge badge-rejected">
                                Not Participated
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
