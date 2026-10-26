/**
 * Central API Client for Student Screenshot Portal
 *
 * Production Render Backend:
 *   https://student-screenshot-portal.onrender.com
 *
 * Local Development:
 *   http://localhost:5000
 */

function getApiBaseUrl() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // In browser environment:
  if (
    typeof window !== 'undefined' &&
    window.location &&
    window.location.hostname
  ) {
    const hostname = window.location.hostname;

    // 1. If running locally (Vite dev server proxies /api and /uploads to port 5000)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '';
    }

    // 2. If hosted on a separated frontend-only static site (e.g. -frontend.onrender.com)
    if (hostname.includes('-frontend.')) {
      return 'https://student-screenshot-portal.onrender.com';
    }

    // 3. If served directly by the unified fullstack web service on Render or custom domain:
    // Relative path '' guarantees all API requests hit the hosting server with no CORS issues
    return '';
  }

  return '';
}

const configuredApiUrl = getApiBaseUrl();
// Avoid duplicate /api segments if configuredApiUrl already ends with /api
const API_BASE = configuredApiUrl
  ? (configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`)
  : '/api';

/**
 * Safely constructs a valid, responsive image URL for hackathon posters
 * across development and production environments.
 *
 * Handles:
 * - Null / undefined / empty string safely (returns null)
 * - Absolute Cloudinary HTTPS / external image URLs
 * - Relative upload paths (avoiding duplicate path segments)
 * - Normalizes Windows backslashes
 * - Strips /api suffix from base URL if present
 */
export function getPosterUrl(posterPath) {
  if (!posterPath || typeof posterPath !== 'string') return null;
  const trimmed = posterPath.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

  // 1. Absolute URL (Cloudinary, HTTPS/HTTP, data URI)
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // 2. Normalize Windows-style backslashes to forward slashes
  const normalized = trimmed.replace(/\\/g, '/');

  // 3. Resolve relative path without duplicate path segments
  let cleanPath = normalized;
  if (cleanPath.startsWith('/uploads/posters/')) {
    // Already normalized relative path
  } else if (cleanPath.startsWith('uploads/posters/')) {
    cleanPath = `/${cleanPath}`;
  } else if (cleanPath.startsWith('/uploads/')) {
    cleanPath = cleanPath;
  } else if (cleanPath.startsWith('uploads/')) {
    cleanPath = `/${cleanPath}`;
  } else if (cleanPath.startsWith('posters/')) {
    cleanPath = `/uploads/${cleanPath}`;
  } else if (cleanPath.startsWith('/posters/')) {
    cleanPath = `/uploads${cleanPath}`;
  } else {
    // Pure filename e.g. "poster-1792308176831-669869020.jpeg"
    cleanPath = `/uploads/posters/${cleanPath.replace(/^\/+/, '')}`;
  }

  // 4. Prepend base origin only if frontend is hosted separately from backend
  const baseUrl = getApiBaseUrl();
  if (baseUrl) {
    // Strip trailing slash and any trailing /api segment so we don't produce /api/uploads
    const origin = baseUrl.replace(/\/+$/, '').replace(/\/api$/, '');
    return `${origin}${cleanPath}`;
  }

  return cleanPath;
}


async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${cleanEndpoint}`;

  const headers = {
    ...options.headers
  };

  // Attach student or admin token if present and valid
  const rawAdminToken = localStorage.getItem('admin_token');
  const rawStudentToken = localStorage.getItem('student_token');

  const adminToken = rawAdminToken && rawAdminToken !== 'null' && rawAdminToken !== 'undefined' ? rawAdminToken.trim() : null;
  const studentToken = rawStudentToken && rawStudentToken !== 'null' && rawStudentToken !== 'undefined' ? rawStudentToken.trim() : null;

  // If endpoint is admin-specific, prioritize admin token
  if (
    cleanEndpoint.includes('/admin') ||
    cleanEndpoint.includes('/participation')
  ) {
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
  } else {
    // Normal student or generic route
    if (studentToken) {
      headers['Authorization'] = `Bearer ${studentToken}`;
    } else if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
  }

  // Set Content-Type to JSON unless sending FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (networkError) {
    console.error(`[API Network Error] URL: ${url}`, networkError);
    const err = new Error(
      `Unable to connect to server at ${configuredApiUrl}. Please ensure the server is active.`
    );
    err.isNetworkError = true;
    err.status = 0;
    throw err;
  }

  const contentType = response.headers.get('content-type') || '';

  // If response is CSV or blob, return blob
  if (contentType.includes('text/csv')) {
    return response.blob();
  }

  let data;

  try {
    data = await response.json();
  } catch (err) {
    const parseErr = new Error(
      `Invalid response from server (HTTP ${response.status}).`
    );
    parseErr.status = response.status;
    parseErr.isNetworkError = false;
    throw parseErr;
  }

  if (!response.ok) {
    let errorMsg = data && data.message;
    if (!errorMsg) {
      if (response.status === 503) {
        errorMsg = 'Service is temporarily unavailable. Please try again.';
      } else if (response.status === 401) {
        errorMsg = 'Session has expired or authentication is required.';
      } else if (response.status === 403) {
        errorMsg = 'Access denied. You do not have permission to perform this action.';
      } else if (response.status === 404) {
        errorMsg = 'Requested resource not found.';
      } else {
        errorMsg = `HTTP ${response.status} Error`;
      }
    }

    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    error.isAuthError = response.status === 401 || response.status === 403;
    error.isExpired = Boolean(
      data?.isExpired ||
      data?.errorCategory === 'SESSION_EXPIRED' ||
      (errorMsg && errorMsg.toLowerCase().includes('expired'))
    );
    error.isNetworkError = false;
    throw error;
  }

  return data;
}

export const api = {
  get: (endpoint) =>
    request(endpoint, {
      method: 'GET'
    }),

  post: (endpoint, body) =>
    request(endpoint, {
      method: 'POST',
      body:
        body instanceof FormData
          ? body
          : JSON.stringify(body)
    }),

  put: (endpoint, body) =>
    request(endpoint, {
      method: 'PUT',
      body:
        body instanceof FormData
          ? body
          : JSON.stringify(body)
    }),

  patch: (endpoint, body) =>
    request(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined
    }),

  delete: (endpoint) =>
    request(endpoint, {
      method: 'DELETE'
    }),

  checkHealth: () =>
    request('/health', {
      method: 'GET'
    }),

  downloadCsv: async (
    endpoint,
    defaultFilename = 'report.csv'
  ) => {
    const blob = await request(endpoint, {
      method: 'GET'
    });

    const downloadUrl = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = defaultFilename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(downloadUrl);
  }
};