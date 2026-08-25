import React from 'react';
import { Sparkles, Search, Settings, ShieldCheck, LogIn } from 'lucide-react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.js';
import { ANDROID_RELEASE } from '../../config/androidRelease.js';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <header className="md:hidden sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
        <div className="p-1.5 bg-gradient-to-tr from-brand-600 to-aurora-cyan rounded-lg text-white">
          <Sparkles className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-bold text-white tracking-tight">Nexa</h1>
      </div>
      <div className="flex items-center gap-2">
        <NavLink
          to="/download"
          className="p-2 text-emerald-400 hover:text-emerald-300 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-1 text-xs font-semibold"
          title="Download NEXA Android App (.apk)"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5516 0 .9997.4482.9997.9993s-.4481.9997-.9997.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5516 0 .9997.4482.9997.9993s-.4481.9997-.9997.9997m11.4045-6.02l1.9973-3.4592c.1251-.2167.0506-.4928-.1661-.6178-.2161-.125-.4922-.0506-.6178.1661l-2.0224 3.5029c-1.5707-.7167-3.3444-1.1166-5.2285-1.1166s-3.6578.4-5.2285 1.1166l-2.0224-3.5029c-.1256-.2167-.4017-.2911-.6178-.1661-.2167.125-.2912.4011-.1661.6178l1.9973 3.4592c-3.149 1.7161-5.328 4.9082-5.7486 8.6534h22.9515c-.4206-3.7452-2.5996-6.9373-5.7486-8.6534" />
          </svg>
          <span className="hidden sm:inline">Get App</span>
        </NavLink>
        <button
          onClick={() => navigate('/search')}
          className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/50"
          title="Search"
        >
          <Search className="w-5 h-5" />
        </button>
        <button
          onClick={() => navigate('/protection')}
          className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/50"
          title="Protection Center"
        >
          <ShieldCheck className="w-5 h-5" />
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/50"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {!user && (
          <button
            onClick={() => navigate('/login')}
            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log in</span>
          </button>
        )}
      </div>
    </header>
  );
};
