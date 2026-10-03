import React, { createContext, useContext, useState, useEffect } from 'react';

const StudentAuthContext = createContext(null);

export function StudentAuthProvider({ children }) {
  const [student, setStudent] = useState(() => {
    try {
      const saved = localStorage.getItem('student_profile');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('student_token') || null);
  const [loading, setLoading] = useState(false);

  const loginStudent = (studentData, sessionToken) => {
    setStudent(studentData);
    setToken(sessionToken);
    localStorage.setItem('student_profile', JSON.stringify(studentData));
    localStorage.setItem('student_token', sessionToken);
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
        isAuthenticated: Boolean(student && token),
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
