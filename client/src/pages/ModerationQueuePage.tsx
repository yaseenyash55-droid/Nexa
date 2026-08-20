import React, { useState } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { ShieldAlert, CheckCircle2, Trash2, AlertTriangle, ShieldCheck, Lock, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { privacyApi, ModerationReport } from '../api/privacy.api.js';

export const ModerationQueuePage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const isModeratorOrAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MODERATOR';

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: reportsRes, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['moderation-reports'],
    queryFn: () => privacyApi.getModerationReports('PENDING'),
    enabled: isModeratorOrAdmin
  });

  const reports = reportsRes?.data || [];

  const actionMutation = useMutation({
    mutationFn: ({ reportId, action }: { reportId: number; action: 'DISMISS' | 'REMOVE_CONTENT' }) =>
      privacyApi.actionModerationReport(reportId, action, `Actioned by ${currentUser?.username || 'moderator'}`),
    onSuccess: (_, variables) => {
      setErrorMsg(null);
      setFeedbackMsg(
        variables.action === 'DISMISS'
          ? `Report #${variables.reportId} was dismissed.`
          : `Report #${variables.reportId} actioned: content flagged for removal.`
      );
      queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to action report.';
      setErrorMsg(msg);
    }
  });

  const handleAction = (reportId: number, action: 'DISMISS' | 'REMOVE_CONTENT') => {
    actionMutation.mutate({ reportId, action });
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
              Moderator review dashboard for user reports and flagged content backed by Oracle Database.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isModeratorOrAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                isLoading={isFetching}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Refresh
              </Button>
            )}
            <span
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
                isModeratorOrAdmin
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {isModeratorOrAdmin ? `${currentUser?.role} Active` : 'Standard Member'}
            </span>
          </div>
        </div>

        {feedbackMsg && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
            <button onClick={() => setFeedbackMsg(null)} className="text-emerald-400/70 hover:text-emerald-200">
              ×
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400/70 hover:text-rose-200">
              ×
            </button>
          </div>
        )}

        {!isModeratorOrAdmin ? (
          <div className="aurora-glass rounded-2xl p-10 text-center space-y-3 border border-slate-800">
            <Lock className="w-10 h-10 text-slate-500 mx-auto" />
            <h2 className="text-base font-bold text-white">Restricted Dashboard</h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              You must have an authenticated Moderator or Administrator role to review and action user moderation reports.
            </p>
          </div>
        ) : isLoading ? (
          <div className="aurora-glass rounded-2xl p-10 text-center text-xs text-slate-400">
            Loading reports from Oracle Database...
          </div>
        ) : (
          /* Reports Queue */
          <div className="space-y-4">
            {reports.length === 0 ? (
              <div className="aurora-glass rounded-2xl p-10 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="text-base font-bold text-white">Queue Empty</h3>
                <p className="text-xs text-slate-400">All user reports have been reviewed in Oracle Database.</p>
              </div>
            ) : (
              reports.map((r: ModerationReport) => (
                <div key={r.reportId} className="aurora-glass rounded-2xl p-5 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {r.targetType.toUpperCase()} Report #{r.reportId} (Target #{r.targetId})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Reported by @{r.reporterUsername || `user_${r.reporterUserId}`} •{' '}
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" /> Reason: {r.reason}
                    </p>
                    {r.details && (
                      <p className="text-xs text-slate-300 mt-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                        "{r.details}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={actionMutation.isPending}
                      onClick={() => handleAction(r.reportId, 'DISMISS')}
                    >
                      Dismiss Report
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      leftIcon={<Trash2 className="w-4 h-4" />}
                      isLoading={actionMutation.isPending && actionMutation.variables?.reportId === r.reportId}
                      onClick={() => handleAction(r.reportId, 'REMOVE_CONTENT')}
                    >
                      Action & Resolve
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};
