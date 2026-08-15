import React from 'react';
import { useTheme, PRESET_CHAT_THEMES, ThemeMode } from '../contexts/ThemeContext';

export interface ThemeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    themeMode,
    setThemeMode,
    autoDayNightShift,
    setAutoDayNightShift,
    currentChatTheme,
    setChatTheme
  } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-6 text-white">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            🎨 Appearance & Themes
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Global Appearance Mode */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Global Appearance
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['dark', 'light', 'system', 'high-contrast'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setThemeMode(mode)}
                className={`py-2.5 px-3 rounded-xl text-xs font-medium border text-left transition-all ${
                  themeMode === mode
                    ? 'bg-purple-950/70 border-purple-500 text-purple-200 shadow-md'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {mode === 'dark' && '🌙 Dark Mode'}
                {mode === 'light' && '☀️ Light Mode'}
                {mode === 'system' && '💻 System Default'}
                {mode === 'high-contrast' && '⚡ High Contrast'}
              </button>
            ))}
          </div>
        </div>

        {/* Auto Day/Night Shift Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-slate-800/40 rounded-xl border border-slate-800">
          <div>
            <p className="text-xs font-semibold text-slate-200">Scheduled Day/Night Shift</p>
            <p className="text-[11px] text-slate-400">Auto-switch theme between 8:00 PM and 6:00 AM</p>
          </div>
          <input
            type="checkbox"
            checked={autoDayNightShift}
            onChange={(e) => setAutoDayNightShift(e.target.checked)}
            className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
          />
        </div>

        {/* Per-Chat Custom Theme Selector */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Chat Room Presets
          </label>
          <div className="flex flex-col gap-2">
            {PRESET_CHAT_THEMES.map((theme) => (
              <div
                key={theme.themeId}
                onClick={() => setChatTheme(theme)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  currentChatTheme.themeId === theme.themeId
                    ? 'bg-purple-950/60 border-purple-500 shadow-md'
                    : 'bg-slate-800/50 border-slate-700/70 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                    style={{ backgroundColor: theme.accentColor }}
                  />
                  <span className="text-xs font-medium text-slate-200">{theme.name}</span>
                </div>
                {currentChatTheme.themeId === theme.themeId && (
                  <span className="text-xs text-purple-400">✓ Active</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors mt-2"
        >
          Done
        </button>
      </div>
    </div>
  );
};
