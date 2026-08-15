import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system' | 'high-contrast';

export interface ChatTheme {
  themeId: string;
  name: string;
  background: string;
  senderBubble: string;
  receiverBubble: string;
  accentColor: string;
}

export const PRESET_CHAT_THEMES: ChatTheme[] = [
  {
    themeId: 'cyber-dark',
    name: 'Cyberpunk Neon',
    background: 'bg-slate-950',
    senderBubble: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white',
    receiverBubble: 'bg-slate-800 text-slate-100 border border-slate-700',
    accentColor: '#8b5cf6'
  },
  {
    themeId: 'emerald-mint',
    name: 'Emerald Aurora',
    background: 'bg-slate-900',
    senderBubble: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
    receiverBubble: 'bg-slate-800 text-slate-100 border border-slate-700',
    accentColor: '#10b981'
  },
  {
    themeId: 'sunset-blaze',
    name: 'Sunset Blaze',
    background: 'bg-slate-950',
    senderBubble: 'bg-gradient-to-r from-rose-600 to-orange-500 text-white',
    receiverBubble: 'bg-slate-800 text-slate-100 border border-slate-700',
    accentColor: '#f43f5e'
  }
];

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  autoDayNightShift: boolean;
  setAutoDayNightShift: (enabled: boolean) => void;
  currentChatTheme: ChatTheme;
  setChatTheme: (theme: ChatTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('nexa_theme_mode') as ThemeMode) || 'dark';
  });

  const [autoDayNightShift, setAutoDayNightShiftState] = useState<boolean>(() => {
    return localStorage.getItem('nexa_auto_daynight') === 'true';
  });

  const [currentChatTheme, setChatThemeState] = useState<ChatTheme>(PRESET_CHAT_THEMES[0]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('nexa_theme_mode', mode);
  };

  const setAutoDayNightShift = (enabled: boolean) => {
    setAutoDayNightShiftState(enabled);
    localStorage.setItem('nexa_auto_daynight', String(enabled));
  };

  const setChatTheme = (theme: ChatTheme) => {
    setChatThemeState(theme);
    localStorage.setItem('nexa_chat_theme', theme.themeId);
  };

  // Day/Night Shifting logic
  useEffect(() => {
    if (!autoDayNightShift) return;

    const checkTimeAndShift = () => {
      const hours = new Date().getHours();
      // Night time: 8 PM (20) to 6 AM (6)
      const isNight = hours >= 20 || hours < 6;
      const targetTheme: ThemeMode = isNight ? 'dark' : 'light';
      if (themeMode !== targetTheme) {
        setThemeModeState(targetTheme);
      }
    };

    checkTimeAndShift();
    const interval = setInterval(checkTimeAndShift, 60000);
    return () => clearInterval(interval);
  }, [autoDayNightShift, themeMode]);

  // Apply theme class to root html element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light', 'high-contrast');

    if (themeMode === 'high-contrast') {
      root.classList.add('dark', 'high-contrast');
    } else if (themeMode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      root.classList.add(themeMode);
    }
  }, [themeMode]);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        autoDayNightShift,
        setAutoDayNightShift,
        currentChatTheme,
        setChatTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
