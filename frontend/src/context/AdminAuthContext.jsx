import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    try {
      const saved = localStorage.getItem('admin_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifyAdminSession() {
      if (token) {
        try {
          const res = await api.get('/admin/auth/me');
          if (res.success && res.admin) {
            setAdmin(res.admin);
            localStorage.setItem('admin_profile', JSON.stringify(res.admin));
          } else {
            logoutAdmin();
          }
        } catch (e) {
          logoutAdmin();
        }
      }
      setLoading(false);
    }
    verifyAdminSession();
  }, [token]);

  const loginAdmin = (adminToken, adminData) => {
    setToken(adminToken);
    setAdmin(adminData);
    localStorage.setItem('admin_token', adminToken);
    localStorage.setItem('admin_profile', JSON.stringify(adminData));
  };

  const logoutAdmin = () => {
    setToken(null);
    setAdmin(null);
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_profile');
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        token,
        isAuthenticated: Boolean(token && admin),
        loginAdmin,
        logoutAdmin,
        loading
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
