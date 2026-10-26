import React, { createContext, useContext, useState, useEffect } from 'react';

const StudentAuthContext = createContext(null);

/**
 * Validates whether a JWT token is expired on the client-side.
 */
export function isTokenExpired(token) {
  if (!token || typeof token !== 'string') return true;
  const clean = token.trim();
  if (!clean || clean === 'null' || clean === 'undefined') return true;
  try {
    const parts = clean.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload || !payload.exp) return false;
    // 5-second grace window
    return Date.now() >= (payload.exp * 1000) - 5000;
  } catch (e) {
    return true;
  }
}

export function StudentAuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem('student_token');
    if (!saved || isTokenExpired(saved)) {
      localStorage.removeItem('student_token');
      localStorage.removeItem('student_profile');
      return null;
    }
    return saved.trim();
  });

  const [student, setStudent] = useState(() => {
    try {
      const savedToken = localStorage.getItem('student_token');
      if (!savedToken || isTokenExpired(savedToken)) {
        return null;
      }
      const saved = localStorage.getItem('student_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [loading, setLoading] = useState(false);

  // Periodically or on focus check if token expired
  useEffect(() => {
    const checkExpiration = () => {
      const currentToken = localStorage.getItem('student_token');
      if (currentToken && isTokenExpired(currentToken)) {
        logoutStudent();
      }
    };

    window.addEventListener('focus', checkExpiration);
    const interval = setInterval(checkExpiration, 60000); // Check every minute

    return () => {
      window.removeEventListener('focus', checkExpiration);
      clearInterval(interval);
    };
  }, []);

  const loginStudent = (studentData, sessionToken) => {
    const cleanToken = sessionToken ? String(sessionToken).trim() : '';
    setStudent(studentData);
    setToken(cleanToken);
    localStorage.setItem('student_profile', JSON.stringify(studentData));
    localStorage.setItem('student_token', cleanToken);
  };

  const logoutStudent = () => {
    setStudent(null);
    setToken(null);
    localStorage.removeItem('student_profile');
    localStorage.removeItem('student_token');
  };

  return (
    <StudentAuthContext.Provider
      value={{
        student,
        token,
        isAuthenticated: Boolean(student && token && !isTokenExpired(token)),
        loginStudent,
        logoutStudent,
        loading
      }}
    >
      {children}
    </StudentAuthContext.Provider>
  );
}

export function useStudentAuth() {
  const context = useContext(StudentAuthContext);
  if (!context) {
    throw new Error('useStudentAuth must be used within a StudentAuthProvider');
  }
  return context;
}
