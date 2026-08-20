import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { authApi } from '../api/auth.api.js';
import { clearAuthSession } from '../api/client.js';
import { syncUserLiveUpdates } from '../utils/capacitorLiveUpdates.js';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: { emailOrUsername: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  requireAuth: (onSuccess: () => void, customMsg?: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function initAuth() {
      try {
        // Attempt silent session hydration via HttpOnly refresh cookie
        await authApi.refresh();
        const me = await authApi.me();
        if (isMounted) {
          setUser(me);
        }
      } catch {
        if (isMounted) {
          setUser(null);
          clearAuthSession();
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

  const login = async (credentials: { emailOrUsername: string; password: string }) => {
    const res = await authApi.login(credentials);
    setUser(res.user);
    await syncUserLiveUpdates(res.user);
  };

  const register = async (data: { username: string; email: string; password: string; displayName: string }) => {
    const res = await authApi.register(data);
    setUser(res.user);
    await syncUserLiveUpdates(res.user);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore logout teardown error
    } finally {
      clearAuthSession();
      setUser(null);
    }
  };

  const requireAuth = (onSuccess: () => void, _customMsg?: string): boolean => {
    if (user) {
      onSuccess();
      return true;
    }
    if (typeof window !== 'undefined') {
      window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
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
