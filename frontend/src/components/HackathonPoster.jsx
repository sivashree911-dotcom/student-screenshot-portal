import React, { useState } from 'react';
import { Trophy, ImageOff } from 'lucide-react';
import { getPosterUrl } from '../services/api';

/**
 * Robust Hackathon Poster Component for Evidera
 *
 * Responsibilities:
 * - Safely resolves poster URLs across development and production
 * - Preserves aspect ratio and prevents layout shift
 * - Catches missing/broken image assets gracefully via onError
 * - Logs diagnosable errors to the developer console
 * - Renders a distinct, honest fallback indicating the poster is unavailable
 *   (without masquerading as a fake real poster)
 * - Retains original poster reference in tooltips for easy troubleshooting
 */
export default function HackathonPoster({
  posterPath,
  name = 'Hackathon',
  institution,
  height = '180px',
  aspectRatio = '16/9',
  style = {},
  className = '',
  children
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const posterUrl = getPosterUrl(posterPath);

  const handleImageError = () => {
    setImageError(true);
    if (posterUrl) {
      console.warn(
        `[Evidera Poster] Failed to load poster image for "${name}".`,
        `Resolved URL: ${posterUrl}`,
        `Original Path: ${posterPath}`
      );
    }
  };

  return (
    <div
      className={`hackathon-poster-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: height || 'auto',
        aspectRatio: !height ? aspectRatio : undefined,
        background: 'linear-gradient(135deg, #E8F0EB 0%, #DFE7E1 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...style
      }}
    >
      {posterUrl && !imageError ? (
        <img
          src={posterUrl}
          alt={name ? `${name} Official Poster` : 'Hackathon Poster'}
          onLoad={() => setImageLoaded(true)}
          onError={handleImageError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transition: 'opacity 0.25s ease-in-out',
            opacity: imageLoaded ? 1 : 0.85
          }}
        />
      ) : posterUrl && imageError ? (
        // Genuine image load failure (e.g., ephemeral storage wiped or network 404)
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            textAlign: 'center',
            width: '100%',
            height: '100%',
            color: 'var(--brand-navy)'
          }}
          title={`Poster file "${posterPath}" is currently unavailable on server.`}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(80, 121, 104, 0.12)',
              color: 'var(--brand-forest)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.45rem'
            }}
          >
            <ImageOff size={20} />
          </div>
          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--brand-navy)',
              maxWidth: '85%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              marginTop: '0.2rem',
              fontWeight: 500
            }}
          >
            Poster unavailable
          </div>
        </div>
      ) : (
        // No poster specified by admin
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            textAlign: 'center',
            width: '100%',
            height: '100%',
            color: 'var(--brand-forest)'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'rgba(80, 121, 104, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.45rem'
            }}
          >
            <Trophy size={20} />
          </div>
          {institution && (
            <div
              style={{
                fontSize: '0.82rem',
                fontWeight: 700,
                color: 'var(--brand-navy)',
                maxWidth: '85%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {institution}
            </div>
          )}
          <span
            style={{
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              marginTop: '0.2rem'
            }}
          >
            No Poster Attached
          </span>
        </div>
      )}

      {/* Render any overlay children (e.g., status badges, active indicators) */}
      {children}
    </div>
  );
}
