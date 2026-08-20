import React, { useState, useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { Palette, Eye, Sparkles, Check } from 'lucide-react';

export const AppearanceSettingsPage: React.FC = () => {
  const [theme, setTheme] = useState<'aurora-dark' | 'midnight-dark' | 'aurora-light'>('aurora-dark');
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [accentColor, setAccentColor] = useState('#2DD4BF');

  useEffect(() => {
    if (reduceTransparency) {
      document.documentElement.classList.add('reduce-transparency');
    } else {
      document.documentElement.classList.remove('reduce-transparency');
    }
  }, [reduceTransparency]);

  useEffect(() => {
    if (reduceMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }, [reduceMotion]);

  const themes = [
    { id: 'aurora-dark', name: 'Nexa Aurora Dark', description: 'Deep slate background with glowing teal & violet accents' },
    { id: 'midnight-dark', name: 'Midnight Pure Black', description: 'Ultra dark true black background for OLED displays' },
    { id: 'aurora-light', name: 'Aurora Light', description: 'Clean high-contrast light theme with soft glass borders' }
  ];

  const accentColors = ['#2DD4BF', '#8B5CF6', '#F472B6', '#FBBF24', '#06B6D4'];

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Palette className="w-5 h-5 text-brand-400" /> Appearance & Theme Controls
          </h1>
          <p className="text-xs text-slate-400">
            Customize Nexa Aurora Glass themes, contrast accessibility, reduce transparency, and motion behavior
          </p>
        </div>

        {/* Theme Selection */}
        <div className="aurora-glass rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" /> Color Theme Options
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themes.map((t) => {
              const isSelected = theme === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setTheme(t.id as any)}
                  className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                    isSelected
                      ? 'bg-brand-600/20 border-brand-500 shadow-glow-brand'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white">{t.name}</span>
                    {isSelected && <Check className="w-4 h-4 text-brand-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400">{t.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Accent Color Palette */}
        <div className="aurora-glass rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-white">Brand Accent Preview</h2>
          <div className="flex items-center gap-3">
            {accentColors.map((color) => (
              <button
                key={color}
                onClick={() => setAccentColor(color)}
                style={{ backgroundColor: color }}
                className={`w-8 h-8 rounded-full transition-transform flex items-center justify-center ${
                  accentColor === color ? 'scale-125 ring-2 ring-white shadow-lg' : 'hover:scale-110'
                }`}
              >
                {accentColor === color && <Check className="w-4 h-4 text-black" />}
              </button>
            ))}
          </div>
        </div>

        {/* Accessibility Toggles */}
        <div className="aurora-glass rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-brand-400" /> Accessibility & Performance Settings
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
              <div>
                <p className="text-xs font-bold text-white">Reduce Transparency</p>
                <p className="text-[11px] text-slate-400">Replaces translucent glass blurs with solid opaque surfaces for maximum contrast</p>
              </div>
              <button
                onClick={() => setReduceTransparency(!reduceTransparency)}
                className={`w-12 h-6 rounded-full transition-colors p-1 relative ${
                  reduceTransparency ? 'bg-brand-600' : 'bg-slate-700'
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${reduceTransparency ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
              <div>
                <p className="text-xs font-bold text-white">Reduce Motion</p>
                <p className="text-[11px] text-slate-400">Disables non-essential UI animations and video autoplays</p>
              </div>
              <button
                onClick={() => setReduceMotion(!reduceMotion)}
                className={`w-12 h-6 rounded-full transition-colors p-1 relative ${
                  reduceMotion ? 'bg-brand-600' : 'bg-slate-700'
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${reduceMotion ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
