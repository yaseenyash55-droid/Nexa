import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { authApi } from '../api/auth.api.js';
import { setAccessToken, getAccessToken } from '../api/client.js';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
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

  const [isLoading, setIsLoading] = useState(true);

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
    async function initAuth() {
      const token = getAccessToken();
      if (token) {
        try {
          const me = await authApi.me();
          setUser(me);
        } catch {
          try {
            await authApi.refresh();
            const me = await authApi.me();
            setUser(me);
          } catch {
            setUser(null);
            setAccessToken(null);
          }
        }
      } else {
        try {
          await authApi.refresh();
          const me = await authApi.me();
          setUser(me);
        } catch {
          // Stay logged out
        }
      }
      setIsLoading(false);
    }
    initAuth();
  }, []);

  const login = async (credentials: any) => {
    const res = await authApi.login(credentials);
    setUser(res.user);
  };

  const register = async (data: any) => {
    const res = await authApi.register(data);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {}
    setAccessToken(null, null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, setUser }}>
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
