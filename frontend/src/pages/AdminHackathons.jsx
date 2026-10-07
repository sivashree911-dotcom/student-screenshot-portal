import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import Modal from '../components/Modal';
import {
  Trophy,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Users,
  ExternalLink,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';

export default function AdminHackathons() {
  const [hackathons, setHackathons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal Form State (Add / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    institution: '',
    description: '',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    mode: 'Offline',
    location: '',
    minTeamSize: 1,
    maxTeamSize: 5,
    allowExternalParticipants: false,
    registrationUrl: '',
    isActive: true
  });
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    loadHackathons();
  }, []);

  async function loadHackathons() {
    setLoading(true);
    try {
      const res = await api.get('/hackathons/admin/all');
      if (res.success) {
        setHackathons(res.hackathons || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load hackathons.');
    } finally {
      setLoading(false);
    }
  }

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      institution: '',
      description: '',
      startDate: '',
      endDate: '',
      registrationDeadline: '',
      mode: 'Offline',
      location: '',
      minTeamSize: 3,
      maxTeamSize: 5,
      allowExternalParticipants: true,
      registrationUrl: '',
      isActive: true
    });
    setPosterFile(null);
    setPosterPreview(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (h) => {
    setEditingId(h.id);
    setFormData({
      name: h.name,
      institution: h.institution,
      description: h.description || '',
      startDate: h.start_date ? h.start_date.split('T')[0] : '',
      endDate: h.end_date ? h.end_date.split('T')[0] : '',
      registrationDeadline: h.registration_deadline ? h.registration_deadline.split('T')[0] : '',
      mode: h.mode || 'Offline',
      location: h.location || '',
      minTeamSize: h.min_team_size || 1,
      maxTeamSize: h.max_team_size || 5,
      allowExternalParticipants: Boolean(h.allow_external_participants),
      registrationUrl: h.registration_url,
      isActive: Boolean(h.is_active)
    });
    setPosterFile(null);
    setPosterPreview(
      h.poster_path
        ? h.poster_path.startsWith('http://') || h.poster_path.startsWith('https://')
          ? h.poster_path
          : `/uploads/posters/${h.poster_path}`
        : null
    );
    setFormError(null);
    setIsModalOpen(true);
  };

  const handlePosterChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPosterFile(file);
      setPosterPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      const data = new FormData();
      Object.keys(formData).forEach((key) => {
        data.append(key, formData[key]);
      });
      if (posterFile) {
        data.append('poster', posterFile);
      }

      if (editingId) {
        await api.put(`/hackathons/admin/${editingId}`, data);
      } else {
        await api.post('/hackathons/admin', data);
      }

      setIsModalOpen(false);
      loadHackathons();
    } catch (err) {
      setFormError(err.message || 'Failed to save hackathon.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await api.patch(`/hackathons/admin/${id}/toggle-status`, {});
      loadHackathons();
    } catch (err) {
      alert(err.message || 'Failed to toggle status.');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the hackathon "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/hackathons/admin/${id}`);
      loadHackathons();
    } catch (err) {
      alert(err.message || 'Failed to delete hackathon.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800 }}>Hackathon Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
            Add, update, activate, and manage college hackathons and registration links.
          </p>
        </div>

        <button onClick={openAddModal} className="btn btn-primary">
          <Plus size={16} />
          <span>Add New Hackathon</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
          <div>Loading hackathons...</div>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : hackathons.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Trophy size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
          <h3>No Hackathons Configured</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            Get started by adding the first hackathon to the portal.
          </p>
          <button onClick={openAddModal} className="btn btn-primary">
            <Plus size={16} /> Add Hackathon
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {hackathons.map((h) => (
            <div
              key={h.id}
              className="card"
              style={{
                padding: 0,
                overflow: 'hidden',
                opacity: h.is_active ? 1 : 0.7,
                border: h.is_active ? '1px solid var(--border-card)' : '1px dashed rgba(255,255,255,0.1)'
              }}
            >
              {/* Poster Preview */}
              <div
                style={{
                  height: '160px',
                  background: '#1e1b4b',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}
              >
                {h.poster_path ? (
                  <img
                    src={
                      h.poster_path.startsWith('http://') || h.poster_path.startsWith('https://')
                        ? h.poster_path
                        : `/uploads/posters/${h.poster_path}`
                    }
                    alt={h.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                    <Trophy size={36} style={{ margin: '0 auto 0.25rem' }} />
                    <span style={{ fontSize: '0.8rem' }}>No Poster Attached</span>
                  </div>
                )}

                <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                  <span className={`badge ${h.is_active ? 'badge-active' : 'badge-inactive'}`}>
                    {h.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                  <span className="badge badge-college">{h.mode}</span>
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--primary-400)', fontWeight: 700 }}>
                  {h.institution}
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0.25rem 0 0.5rem', lineHeight: 1.3 }}>
                  {h.name}
                </h3>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem', margin: '0.85rem 0' }}>
                  <div>Dates: <strong>{formatDate(h.start_date)} – {formatDate(h.end_date)}</strong></div>
                  <div>Deadline: <strong>{formatDate(h.registration_deadline)}</strong></div>
                  <div>Team Size: <strong>{h.min_team_size}–{h.max_team_size} Members</strong> ({h.allow_external_participants ? 'External Allowed' : 'College Only'})</div>
                </div>

                {/* Submissions Mini Stats */}
                <div style={{ display: 'flex', gap: '0.75rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', marginBottom: '1.25rem' }}>
                  <div>Total: <strong>{h.total_submissions || 0}</strong></div>
                  <div>•</div>
                  <div style={{ color: 'var(--accent-emerald)' }}>Verified: <strong>{h.verified_submissions || 0}</strong></div>
                  <div>•</div>
                  <div style={{ color: 'var(--accent-amber)' }}>Pending: <strong>{h.pending_submissions || 0}</strong></div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => openEditModal(h)}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleToggleStatus(h.id)}
                    className={`btn btn-sm ${h.is_active ? 'btn-secondary' : 'btn-success'}`}
                  >
                    {h.is_active ? 'Deactivate' : 'Activate'}
                  </button>

                  <button
                    onClick={() => handleDelete(h.id, h.name)}
                    className="btn btn-danger btn-sm"
                    title="Delete Hackathon"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingId ? 'Edit Hackathon' : 'Add New Hackathon'}
          maxWidth="700px"
        >
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-danger">{formError}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Hackathon Name <span style={{ color: 'var(--accent-rose)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Hack Odyssey 4.0"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Organizing Institution <span style={{ color: 'var(--accent-rose)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Kalasalingam Academy of Research and Education"
                  required
                  value={formData.institution}
                  onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  placeholder="Short overview of the hackathon theme and challenges..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Start Date <span style={{ color: 'var(--accent-rose)' }}>*</span></label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Date <span style={{ color: 'var(--accent-rose)' }}>*</span></label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Registration Deadline <span style={{ color: 'var(--accent-rose)' }}>*</span></label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={formData.registrationDeadline}
                  onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mode</label>
                <select
                  className="form-select"
                  value={formData.mode}
                  onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                >
                  <option value="Offline">Offline</option>
                  <option value="Online">Online</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Location / Venue</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Main Auditorium / Block 4"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Min Team Size</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="form-input"
                  value={formData.minTeamSize}
                  onChange={(e) => setFormData({ ...formData, minTeamSize: parseInt(e.target.value, 10) || 1 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Max Team Size</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="form-input"
                  value={formData.maxTeamSize}
                  onChange={(e) => setFormData({ ...formData, maxTeamSize: parseInt(e.target.value, 10) || 5 })}
                />
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">External Registration URL <span style={{ color: 'var(--accent-rose)' }}>*</span></label>
                <input
                  type="url"
                  className="form-input"
                  placeholder="https://unstop.com/hackathons/..."
                  required
                  value={formData.registrationUrl}
                  onChange={(e) => setFormData({ ...formData, registrationUrl: e.target.value })}
                />
              </div>

              {/* Poster Upload */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Hackathon Poster Image</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="form-input"
                  onChange={handlePosterChange}
                />
                {posterPreview && (
                  <div style={{ marginTop: '0.75rem', maxHeight: '160px', overflow: 'hidden', borderRadius: 'var(--radius-md)', background: '#000', textAlign: 'center' }}>
                    <img src={posterPreview} alt="Poster preview" style={{ maxHeight: '160px', width: 'auto', objectFit: 'contain' }} />
                  </div>
                )}
              </div>

              {/* Checkboxes */}
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '2rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.allowExternalParticipants}
                    onChange={(e) => setFormData({ ...formData, allowExternalParticipants: e.target.checked })}
                  />
                  <span>Allow External Participants</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span>Hackathon Active</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={formSubmitting}
              >
                {formSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{editingId ? 'Update Hackathon' : 'Create Hackathon'}</span>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
