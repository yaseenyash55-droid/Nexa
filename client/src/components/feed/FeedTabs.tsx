import React from 'react';
import { Globe, Users } from 'lucide-react';

interface FeedTabsProps {
  activeTab: 'global' | 'following';
  onChange: (tab: 'global' | 'following') => void;
  isAuthenticated: boolean;
}

export const FeedTabs: React.FC<FeedTabsProps> = ({ activeTab, onChange, isAuthenticated }) => {
  return (
    <div className="flex items-center border-b border-slate-800/80 bg-background/80 backdrop-blur-md sticky top-0 md:top-0 z-30">
      <button
        onClick={() => onChange('global')}
        className={`flex-1 py-3.5 px-4 text-center font-semibold text-sm transition-all flex items-center justify-center gap-2 border-b-2 ${
          activeTab === 'global'
            ? 'border-brand-500 text-brand-400 bg-brand-500/5'
            : 'border-transparent text-slate-400 hover:text-slate-200'
        }`}
      >
        <Globe className="w-4 h-4" />
        <span>Global Feed</span>
      </button>

      {isAuthenticated && (
        <button
          onClick={() => onChange('following')}
          className={`flex-1 py-3.5 px-4 text-center font-semibold text-sm transition-all flex items-center justify-center gap-2 border-b-2 ${
            activeTab === 'following'
              ? 'border-brand-500 text-brand-400 bg-brand-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Following Feed</span>
        </button>
      )}
    </div>
  );
};
