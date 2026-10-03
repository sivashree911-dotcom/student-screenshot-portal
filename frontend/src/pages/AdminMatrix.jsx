import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Grid3X3, Download, Search, CheckCircle2, Minus, Loader2 } from 'lucide-react';

export default function AdminMatrix() {
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadMatrix();
  }, []);

  async function loadMatrix() {
    setLoading(true);
    try {
      const res = await api.get('/participation/reports/matrix');
      if (res.success) {
        setMatrixData(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to load participation matrix.');
    } finally {
      setLoading(false);
    }
  }

  const handleExportMatrixCsv = () => {
    if (!matrixData) return;

    const headers = ['Register Number', 'Student Name', 'Department', 'Year', 'Total Participations', ...matrixData.hackathons.map(h => `"${h.name}"`)];
    const rows = [headers];

    for (const st of matrixData.matrix) {
      const hackCols = matrixData.hackathons.map(h => st.hackathons[h.id] ? 'Participated' : 'Not Participated');
      rows.push([
        `"${st.registerNumber}"`,
        `"${st.name.replace(/"/g, '""')}"`,
        `"${st.department}"`,
        `"${st.year}"`,
        st.totalEventsParticipated,
        ...hackCols.map(c => `"${c}"`)
      ]);
    }

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `overall_participation_matrix_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredMatrix = (matrixData?.matrix || []).filter((st) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return st.registerNumber.toLowerCase().includes(q) || st.name.toLowerCase().includes(q) || st.department.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Overall Participation Matrix</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Comprehensive cross-hackathon engagement matrix for all approved students.
          </p>
        </div>

        <button
          onClick={handleExportMatrixCsv}
          className="btn btn-secondary"
          disabled={loading || !matrixData}
        >
          <Download size={15} />
          <span>Export Matrix CSV</span>
        </button>
      </div>

      {/* Search filter */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: '400px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            className="form-input"
            placeholder="Search student or register number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Matrix Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            Student Engagement Grid ({filteredMatrix.length} Students)
          </h2>
          <span className="badge badge-college">{matrixData?.hackathons?.length || 0} Hackathons Monitored</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            <div>Building participation matrix...</div>
          </div>
        ) : error ? (
          <div className="alert alert-danger" style={{ margin: '1.5rem' }}>{error}</div>
        ) : (
          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '120px' }}>Register No</th>
                  <th style={{ minWidth: '160px' }}>Student Name</th>
                  <th>Dept</th>
                  <th>Year</th>
                  <th style={{ textAlign: 'center' }}>Events</th>
                  {matrixData?.hackathons?.map((h) => (
                    <th key={h.id} style={{ minWidth: '150px', textAlign: 'center' }}>
                      {h.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMatrix.map((st) => (
                  <tr key={st.registerNumber}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--primary-400)' }}>
                      {st.registerNumber}
                    </td>
                    <td style={{ fontWeight: 600 }}>{st.name}</td>
                    <td><span className="badge badge-college">{st.department}</span></td>
                    <td>Yr {st.year}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-active font-mono" style={{ fontWeight: 800 }}>
                        {st.totalEventsParticipated}
                      </span>
                    </td>
                    {matrixData?.hackathons?.map((h) => {
                      const didParticipate = st.hackathons[h.id];
                      return (
                        <td key={h.id} style={{ textAlign: 'center' }}>
                          {didParticipate ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                color: 'var(--accent-emerald)',
                                fontWeight: 700,
                                background: 'rgba(16, 185, 129, 0.12)',
                                padding: '0.2rem 0.6rem',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.78rem'
                              }}
                            >
                              <CheckCircle2 size={12} />
                              <span>Participated</span>
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
