import React from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { BarChart3, TrendingUp, Eye, Heart, Users, Sparkles, ShieldCheck } from 'lucide-react';

export const CreatorInsightsPage: React.FC = () => {

  const metrics = [
    { label: 'Total Reach (30 Days)', value: '14,280', change: '+18.4%', icon: <Eye className="w-5 h-5 text-aurora-cyan" /> },
    { label: 'Engagement Rate', value: '6.8%', change: '+2.1%', icon: <TrendingUp className="w-5 h-5 text-emerald-400" /> },
    { label: 'Total Reactions & Likes', value: '1,840', change: '+12.5%', icon: <Heart className="w-5 h-5 text-rose-400" /> },
    { label: 'New Followers', value: '+342', change: '+24.0%', icon: <Users className="w-5 h-5 text-brand-400" /> }
  ];

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header Bar */}
        <div className="aurora-glass rounded-2xl p-5 border border-brand-500/30 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-tr from-brand-600 to-aurora-cyan rounded-xl text-white shadow-glow-brand">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Creator Insights</h1>
            </div>
            <p className="text-xs text-slate-300">
              Privacy-safe aggregate analytics for your posts, bytes, and cosmic.
            </p>
          </div>
          <span className="aurora-badge text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Privacy-Safe
          </span>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m, idx) => (
            <div key={idx} className="aurora-glass rounded-2xl p-4 space-y-2 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{m.label}</span>
                {m.icon}
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-2xl font-extrabold text-white tracking-tight">{m.value}</span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">{m.change}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Top Content Chart Overview */}
        <div className="aurora-glass rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" /> Top Performing Posts & Bytes
          </h3>
          <div className="space-y-3">
            <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white">"Welcome to Nexa! 🚀 Share. Connect. Discover."</p>
                <p className="text-[11px] text-slate-400">Post • Published 3 days ago</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5 text-cyan-400" /> 4,120</span>
                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-400" /> 428</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
