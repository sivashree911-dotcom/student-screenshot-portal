import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Users, Search, Filter, CheckCircle2, ShieldCheck, RefreshCw, Loader2 } from 'lucide-react';

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [year, setYear] = useState('All');

  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (department !== 'All') queryParams.append('department', department);
      if (year !== 'All') queryParams.append('year', year);

      const res = await api.get(`/students/all?${queryParams.toString()}`);
      if (res.success) {
        setStudents(res.students || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load approved students.');
    } finally {
      setLoading(false);
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadStudents();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Approved Student Registry</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Source of truth for approved college students eligible for hackathon participation.
          </p>
        </div>

        <button onClick={loadStudents} className="btn btn-secondary btn-sm" disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Student List</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Search Register No / Name:</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. 1300 or Arjun"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Department:</label>
            <select
              className="form-select"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="All">All Departments</option>
              <option value="CSE">CSE</option>
              <option value="IT">IT</option>
              <option value="ECE">ECE</option>
              <option value="AI & DS">AI & DS</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Academic Year:</label>
            <select
              className="form-select"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="All">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>
            <Search size={16} />
            <span>Search</span>
          </button>
        </form>
      </div>

      {/* Student List Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            Approved College Students ({students.length})
          </h2>
          <span className="badge badge-college">Google Sheet / Database Sync</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            <div>Loading student records...</div>
          </div>
        ) : error ? (
          <div className="alert alert-danger" style={{ margin: '1.5rem' }}>{error}</div>
        ) : students.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--text-muted)' }}>
            No approved students matching the filter criteria.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Register Number</th>
                  <th>Student Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Year</th>
                  <th>Section</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st, i) => (
                  <tr key={st.registerNumber || i}>
                    <td className="font-mono" style={{ fontWeight: 700, color: 'var(--primary-400)' }}>
                      {st.registerNumber}
                    </td>
                    <td style={{ fontWeight: 600 }}>{st.name}</td>
                    <td className="font-mono text-muted" style={{ fontSize: '0.84rem' }}>{st.email || '-'}</td>
                    <td><span className="badge badge-college">{st.department}</span></td>
                    <td>Year {st.year}</td>
                    <td>Sec {st.section || 'A'}</td>
                    <td>
                      <span className={`badge ${st.status === 'Active' ? 'badge-active' : 'badge-inactive'}`}>
                        {st.status || 'Active'}
                      </span>
                    </td>
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
