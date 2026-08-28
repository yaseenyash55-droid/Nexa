import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Compass, Bookmark, Bell, User as UserIcon, PlusCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { useToast } from '../../contexts/ToastContext.js';

interface MobileBottomNavigationProps {
  onOpenComposer?: () => void;
}

export const MobileBottomNavigation: React.FC<MobileBottomNavigationProps> = ({ onOpenComposer }) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const items = [
    { to: '/', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { to: '/explore', label: 'Explore', icon: <Compass className="w-5 h-5" /> },
    { to: '/notifications', label: 'Notifs', icon: <Bell className="w-5 h-5" /> },
    { to: '/bookmarks', label: 'Saved', icon: <Bookmark className="w-5 h-5" /> },
    { to: user ? `/profile/${user.username}` : '/login', label: 'Profile', icon: <UserIcon className="w-5 h-5" /> }
  ];

  return (
    <nav aria-label="Mobile Bottom Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background-card/90 backdrop-blur-lg border-t border-slate-800/80 px-2 py-2 pb-safe flex items-center justify-around">
      {items.slice(0, 2).map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 p-2 rounded-xl text-xs font-medium ${
              isActive ? 'text-brand-400 font-semibold' : 'text-slate-400'
            }`
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}

      {/* Center Create Post Action */}
      {onOpenComposer && (
        <button
          onClick={() => {
            if (user) {
              onOpenComposer();
            } else {
              toast.error('Authentication required to create posts.');
              window.location.href = '/login';
            }
          }}
          className="p-3 bg-brand-600 text-white rounded-full shadow-lg shadow-brand-600/40 transform -translate-y-2"
          title={user ? 'Create Post' : 'Log in to create post'}
        >
          <PlusCircle className="w-6 h-6" />
        </button>
      )}

      {items.slice(2).map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 p-2 rounded-xl text-xs font-medium ${
              isActive ? 'text-brand-400 font-semibold' : 'text-slate-400'
            }`
          }
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};
