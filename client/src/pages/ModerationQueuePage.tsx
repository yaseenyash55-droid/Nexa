import React, { useState } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { ShieldAlert, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button.js';

export const ModerationQueuePage: React.FC = () => {
  const [reports, setReports] = useState([
    { id: 1, type: 'Post', targetId: 102, reporter: 'user_alex', reason: 'Spam or Scam Content', detail: 'Promoting unverified crypto links.', status: 'Pending' },
    { id: 2, type: 'Reel', targetId: 4, reporter: 'sarah_design', reason: 'Copyright Issue', detail: 'Uncredited music audio track.', status: 'Pending' }
  ]);

  const handleAction = (reportId: number, action: 'dismiss' | 'remove') => {
    setReports(prev => prev.filter(r => r.id !== reportId));
    alert(action === 'dismiss' ? 'Report dismissed.' : 'Content removed and warning issued to author.');
  };

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header Bar */}
        <div className="aurora-glass rounded-2xl p-5 border border-brand-500/30 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-tr from-rose-600 to-amber-500 rounded-xl text-white shadow-lg">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Moderation Queue</h1>
            </div>
            <p className="text-xs text-slate-300">
              Moderator review dashboard for user reports and flagged content.
            </p>
          </div>
          <span className="aurora-badge text-xs font-semibold px-3 py-1.5 rounded-full text-amber-300 border-amber-500/40">
            Moderator Role Active
          </span>
        </div>

        {/* Reports Queue */}
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="aurora-glass rounded-2xl p-10 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Queue Empty</h3>
              <p className="text-xs text-slate-400">All user reports have been reviewed!</p>
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="aurora-glass rounded-2xl p-5 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {r.type} Report #{r.id}
                  </span>
                  <span className="text-[11px] text-slate-400">Reported by @{r.reporter}</span>
                </div>

                <div>
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Reason: {r.reason}
                  </p>
                  <p className="text-xs text-slate-300 mt-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    "{r.detail}"
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <Button size="sm" variant="ghost" onClick={() => handleAction(r.id, 'dismiss')}>
                    Dismiss Report
                  </Button>
                  <Button size="sm" variant="danger" leftIcon={<Trash2 className="w-4 h-4" />} onClick={() => handleAction(r.id, 'remove')}>
                    Remove Content
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
};
