import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Compass, Film, MessageSquare, Bookmark, Bell, User as UserIcon, Settings as SettingsIcon, BookOpen, ShieldCheck, BarChart3, ShieldAlert, LogOut, PlusSquare, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { Avatar } from '../ui/Avatar.js';
import { DrDoomOrbLogo } from '../ui/DrDoomOrbLogo.js';

interface SidebarNavigationProps {
  onOpenComposer?: () => void;
}

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({ onOpenComposer }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Home Feed', icon: <Home className="w-5 h-5" /> },
    { to: '/explore', label: 'Explore', icon: <Compass className="w-5 h-5" /> },
    { to: '/reels', label: 'Reels', icon: <Film className="w-5 h-5" /> },
    { to: '/messages', label: 'Messages', icon: <MessageSquare className="w-5 h-5" /> },
    { to: '/notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" /> },
    { to: '/user-manual', label: 'User Manual', icon: <BookOpen className="w-5 h-5" /> },
    { to: user ? `/profile/${user.username}` : '/login', label: 'Profile', icon: <UserIcon className="w-5 h-5" /> },
    { to: '/settings', label: 'Settings', icon: <SettingsIcon className="w-5 h-5" /> }
  ];

  return (
    <aside className="sticky top-0 h-screen w-64 p-4 flex flex-col justify-between border-r border-slate-800/80 bg-background/50">
      <div className="space-y-4">
        {/* Branding Logo - Dr. Doom Holding Magical Orb */}
        <div className="flex items-center gap-2 px-3 py-2 cursor-pointer border-b border-slate-800/60 pb-3" onClick={() => navigate('/')}>
          <DrDoomOrbLogo size={40} showText={true} />
        </div>

        {/* Download Android APK Badge Button */}
        <a
          href="/nexa-social-app.apk"
          download="nexa-social-app.apk"
          className="mx-1 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center justify-between group shadow-sm"
          title="Download NEXA Android App (.apk)"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5516 0 .9997.4482.9997.9993s-.4481.9997-.9997.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5516 0 .9997.4482.9997.9993s-.4481.9997-.9997.9997m11.4045-6.02l1.9973-3.4592c.1251-.2167.0506-.4928-.1661-.6178-.2161-.125-.4922-.0506-.6178.1661l-2.0224 3.5029c-1.5707-.7167-3.3444-1.1166-5.2285-1.1166s-3.6578.4-5.2285 1.1166l-2.0224-3.5029c-.1256-.2167-.4017-.2911-.6178-.1661-.2167.125-.2912.4011-.1661.6178l1.9973 3.4592c-3.149 1.7161-5.328 4.9082-5.7486 8.6534h22.9515c-.4206-3.7452-2.5996-6.9373-5.7486-8.6534" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-300 leading-tight">Android App</p>
              <p className="text-[9px] text-emerald-400/80">Download APK</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-300">v1.0</span>
        </a>

        {/* Navigation Items */}
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-3.5 py-2 rounded-xl font-medium text-xs transition-all ${
                  isActive
                    ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30 font-semibold shadow-glow-brand'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Create Post Button */}
        <button
          onClick={() => {
            if (user) {
              onOpenComposer?.();
            } else {
              navigate('/login');
            }
          }}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-brand-600 to-aurora-cyan hover:from-brand-500 hover:to-aurora-cyan text-white font-medium rounded-xl shadow-glow-brand flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] text-xs"
        >
          <PlusSquare className="w-4 h-4" />
          <span>Create Post</span>
        </button>
      </div>

      {/* User Profile / Auth Footer */}
      {user ? (
        <div className="p-3 border border-slate-800/80 rounded-2xl bg-background-card/60 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => navigate(`/profile/${user.username}`)}>
            <Avatar src={user.profileImageUrl} name={user.displayName} size="md" />
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 truncate">@{user.username}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-3 border border-slate-800/80 rounded-2xl bg-background-card/60 space-y-2">
          <p className="text-xs font-medium text-slate-300 text-center">Join Nexa Community</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/login')}
              className="flex-1 py-2 px-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold text-center transition-colors shadow-sm"
            >
              Log in
            </button>
            <button
              onClick={() => navigate('/register')}
              className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold text-center transition-colors"
            >
              Sign up
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
