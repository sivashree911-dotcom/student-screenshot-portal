/**
 * Central API Client for Student Screenshot Portal
 *
 * In production:
 *   VITE_API_URL=https://student-screenshot-portal.onrender.com
 *
 * In local development:
 *   VITE_API_URL=http://localhost:5000
 */

const configuredApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const API_BASE = `${configuredApiUrl.replace(/\/+$/, '')}/api`;

async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${cleanEndpoint}`;

  const headers = {
    ...options.headers
  };

  // Attach student or admin token if present
  const adminToken = localStorage.getItem('admin_token');
  const studentToken = localStorage.getItem('student_token');

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

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';

  // If response is CSV or blob, return blob
  if (contentType.includes('text/csv')) {
    return response.blob();
  }

  let data;

  try {
    data = await response.json();
  } catch (err) {
    throw new Error(
      `Invalid response from server. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    const error = new Error(
      data.message || `HTTP ${response.status} Error`
    );

    error.status = response.status;
    error.data = data;

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