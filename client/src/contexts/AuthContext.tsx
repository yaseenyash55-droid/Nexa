import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { authApi } from '../api/auth.api.js';
import { setAccessToken, getAccessToken } from '../api/client.js';
import { syncUserLiveUpdates } from '../utils/capacitorLiveUpdates.js';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  requireAuth: (onSuccess: () => void, customMsg?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const savedUserStr = localStorage.getItem('nexa_user_session');
    if (savedUserStr) {
      try {
        return JSON.parse(savedUserStr);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setUser: React.Dispatch<React.SetStateAction<User | null>> = (action) => {
    setUserState((prev) => {
      const nextUser = typeof action === 'function' ? action(prev) : action;
      if (typeof window !== 'undefined') {
        if (nextUser) {
          localStorage.setItem('nexa_user_session', JSON.stringify(nextUser));
        } else {
          localStorage.removeItem('nexa_user_session');
        }
      }
      return nextUser;
    });
  };

  useEffect(() => {
    let isMounted = true;
    async function initAuth() {
      const token = getAccessToken();
      try {
        if (token) {
          try {
            const me = await authApi.me();
            if (isMounted) setUser(me);
          } catch {
            await authApi.refresh();
            const me = await authApi.me();
            if (isMounted) setUser(me);
          }
        } else {
          await authApi.refresh();
          const me = await authApi.me();
          if (isMounted) setUser(me);
        }
      } catch {
        if (isMounted) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    initAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('shouldBlockReload', 'true');
    }
    try {
      const res = await authApi.login(credentials);
      setUser(res.user);
      
      // Perform user-specific Live Updates sync based on logged in user details
      await syncUserLiveUpdates(res.user);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.setItem('shouldBlockReload', 'false');
      }
    }
  };

  const register = async (data: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('shouldBlockReload', 'true');
    }
    try {
      const res = await authApi.register(data);
      setUser(res.user);
      await syncUserLiveUpdates(res.user);
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.setItem('shouldBlockReload', 'false');
      }
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {}
    setAccessToken(null, null);
    setUser(null);
  };

  const requireAuth = (onSuccess: () => void, customMsg?: string): boolean => {
    if (user) {
      onSuccess();
      return true;
    }
    const msg = customMsg || 'Please log in to perform this action.';
    alert(`🔒 Authentication Required\n\n${msg}`);
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, setUser, requireAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
