import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface AdminAuthContextType {
  isAdmin: boolean;
  logout: () => void;
  resetInactivityTimer: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

interface AdminAuthProviderProps {
  children: React.ReactNode;
}

export const AdminAuthProvider: React.FC<AdminAuthProviderProps> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  
  // Inactivity timer (10 minutes = 600,000 ms)
  const INACTIVITY_TIMEOUT = 10 * 60 * 1000;
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);

  const logout = useCallback(() => {
    setIsAdmin(false);
    // Clear any stored admin session data
    localStorage.removeItem('admin-session-start');
    navigate('/request');
  }, [navigate]);

  const resetInactivityTimer = useCallback(() => {
    // Clear existing timer
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      console.log('Admin session expired due to inactivity');
      logout();
    }, INACTIVITY_TIMEOUT);

    setInactivityTimer(timer);
  }, [inactivityTimer, logout]);

  // Activity event handlers
  const handleActivity = useCallback(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  // Check admin status and session expiration
  const checkAdminStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if admin session has expired
        const sessionStart = localStorage.getItem('admin-session-start');
        const now = Date.now();
        
        if (sessionStart) {
          const sessionAge = now - parseInt(sessionStart);
          if (sessionAge >= INACTIVITY_TIMEOUT) {
            console.log('Admin session expired, logging out');
            logout();
            return;
          }
        } else {
          // First time accessing admin, set session start time
          localStorage.setItem('admin-session-start', now.toString());
        }
        
        setIsAdmin(true);
        resetInactivityTimer();
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setReady(true);
    }
  }, [resetInactivityTimer, logout]);

  useEffect(() => {
    checkAdminStatus();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Set session start time when signing in
        localStorage.setItem('admin-session-start', Date.now().toString());
        setIsAdmin(true);
        resetInactivityTimer();
      } else if (event === 'SIGNED_OUT') {
        setIsAdmin(false);
        if (inactivityTimer) {
          clearTimeout(inactivityTimer);
        }
        localStorage.removeItem('admin-session-start');
      }
    });

    // Set up activity listeners
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      subscription.unsubscribe();
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
    };
  }, [checkAdminStatus, resetInactivityTimer, handleActivity, logout, inactivityTimer]);

  if (!ready) {
    return null;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AdminAuthContext.Provider value={{ isAdmin, logout, resetInactivityTimer }}>
      {children}
    </AdminAuthContext.Provider>
  );
};
