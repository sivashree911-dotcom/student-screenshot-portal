import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, X, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export default function FileUpload({ file, onFileSelect, onFileRemove, label = 'Upload Registration Proof Screenshot' }) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const inputRef = useRef(null);

  const validateAndProcessFile = (selectedFile) => {
    setError(null);
    if (!selectedFile) return;

    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setError('Please upload a valid PNG, JPG, JPEG, or WEBP image.');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('Image exceeds maximum allowed size of 5 MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    onFileSelect(selectedFile);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    onFileRemove();
  };

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <label className="form-label" style={{ marginBottom: '0.6rem' }}>
        {label} <span style={{ color: 'var(--accent-rose)' }}>*</span>
      </label>

      {file && previewUrl ? (
        <div
          style={{
            border: '2px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            background: 'rgba(16, 185, 129, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-emerald)', fontSize: '0.9rem', fontWeight: 600 }}>
              <CheckCircle size={18} />
              <span>Screenshot ready for submission</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.8rem' }}
              >
                <RefreshCw size={13} />
                <span>Replace</span>
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="btn btn-danger btn-sm"
                style={{ fontSize: '0.8rem' }}
              >
                <X size={13} />
                <span>Remove</span>
              </button>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              maxHeight: '260px',
              background: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <img
              src={previewUrl}
              alt="Screenshot Preview"
              style={{ maxHeight: '260px', width: 'auto', objectFit: 'contain' }}
            />
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Filename: <span className="font-mono text-secondary">{file.name}</span> ({(file.size / (1024 * 1024)).toFixed(2)} MB)
          </div>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? 'var(--primary-500)' : 'var(--border-card)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            backgroundColor: dragActive ? 'rgba(99, 102, 241, 0.08)' : 'rgba(15, 23, 42, 0.5)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--primary-400)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem'
            }}
          >
            <UploadCloud size={28} />
          </div>

          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            Click to upload screenshot or drag & drop
          </div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Accepted formats: <strong style={{ color: 'var(--text-secondary)' }}>PNG, JPG, JPEG, WEBP</strong> (Max: 5 MB)
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {error && (
        <div className="error-text" style={{ marginTop: '0.5rem' }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
