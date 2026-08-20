import React, { useState, useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { 
  ShieldCheck, 
  KeyRound, 
  Smartphone, 
  Filter, 
  Moon, 
  Check, 
  Lock, 
  Sparkles,
  Info
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { api } from '../api/client.js';

interface SessionItem {
  sessionId?: string;
  id?: string | number;
  device?: string;
  ipAddress?: string;
  location?: string;
  lastActiveAt?: string;
  createdAt?: string;
  current?: boolean;
}

export const ProtectionCenterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'security' | 'privacy' | 'moderation' | 'wellbeing'>('security');

  // Security Status & Sessions from backend
  const [securityStatus, setSecurityStatus] = useState<{ emailVerified: boolean; mfaEnabled: boolean } | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);
  const [sessionActionMsg, setSessionActionMsg] = useState<string | null>(null);

  // Privacy Settings from backend
  const [privacySettings, setPrivacySettings] = useState({
    isPrivate: false,
    whoCanMessage: 'EVERYONE',
    whoCanComment: 'EVERYONE',
    activityStatusVisible: true,
    readReceiptsEnabled: true,
    hideLikeCounts: false
  });
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);
  const [privacySuccessMsg, setPrivacySuccessMsg] = useState<string | null>(null);

  // Moderation: Hidden Words from backend
  const [hiddenWords, setHiddenWords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [isSavingWords, setIsSavingWords] = useState(false);

  // Wellbeing local settings
  const [quietMode, setQuietMode] = useState(false);
  const [takeBreakMinutes, setTakeBreakMinutes] = useState(30);

  // Load real security status and sessions on mount
  useEffect(() => {
    let isMounted = true;
    async function loadSecurityData() {
      setIsSessionsLoading(true);
      try {
        const [statusRes, sessionsRes, privacyRes, wordsRes] = await Promise.allSettled([
          api.get('/security/status'),
          api.get('/security/sessions'),
          api.get('/privacy/settings'),
          api.get('/privacy/hidden-words')
        ]);

        if (isMounted) {
          if (statusRes.status === 'fulfilled') {
            setSecurityStatus(statusRes.value.data?.data || null);
          }
          if (sessionsRes.status === 'fulfilled') {
            const rawSessions = sessionsRes.value.data?.data || [];
            setSessions(rawSessions);
          }
          if (privacyRes.status === 'fulfilled') {
            setPrivacySettings(prev => ({ ...prev, ...(privacyRes.value.data?.data || {}) }));
          }
          if (wordsRes.status === 'fulfilled') {
            setHiddenWords(wordsRes.value.data?.data || []);
          }
        }
      } catch (err) {
        console.error('Failed to load protection data:', err);
      } finally {
        if (isMounted) setIsSessionsLoading(false);
      }
    }
    loadSecurityData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRevokeSession = async (sessionId: string | number) => {
    try {
      setSessionActionMsg(null);
      await api.delete(`/security/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => (s.sessionId || s.id) !== sessionId));
      setSessionActionMsg('Session revoked successfully.');
    } catch (err: any) {
      setSessionActionMsg(err.response?.data?.error?.message || 'Failed to revoke session.');
    }
  };

  const handleSavePrivacy = async () => {
    try {
      setIsSavingPrivacy(true);
      setPrivacySuccessMsg(null);
      await api.put('/privacy/settings', privacySettings);
      setPrivacySuccessMsg('Privacy preferences saved successfully.');
    } catch (err) {
      console.error('Failed to save privacy settings:', err);
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  const handleAddHiddenWord = async (e: React.FormEvent) => {
    e.preventDefault();
    const word = newKeyword.trim().toLowerCase();
    if (!word || hiddenWords.includes(word)) return;

    const nextWords = [...hiddenWords, word];
    setHiddenWords(nextWords);
    setNewKeyword('');
    try {
      setIsSavingWords(true);
      await api.put('/privacy/hidden-words', { words: nextWords });
    } catch (err) {
      console.error('Failed to update hidden words:', err);
    } finally {
      setIsSavingWords(false);
    }
  };

  const handleRemoveHiddenWord = async (wordToRemove: string) => {
    const nextWords = hiddenWords.filter(w => w !== wordToRemove);
    setHiddenWords(nextWords);
    try {
      await api.put('/privacy/hidden-words', { words: nextWords });
    } catch (err) {
      console.error('Failed to remove hidden word:', err);
    }
  };

  const tabs = [
    { id: 'security', label: '2FA & Devices', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy & Permissions', icon: <Lock className="w-4 h-4" /> },
    { id: 'moderation', label: 'Safety & Hidden Words', icon: <Filter className="w-4 h-4" /> },
    { id: 'wellbeing', label: 'Quiet Mode & Health', icon: <Moon className="w-4 h-4" /> }
  ];

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Protection Center Header */}
        <div className="aurora-glass rounded-2xl p-5 border border-brand-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-xl text-white shadow-lg shadow-brand-600/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Protection Hub</h1>
            </div>
            <p className="text-xs text-slate-300">
              Account security, device sessions, privacy preferences, and content filtering.
            </p>
          </div>
          <span className="aurora-badge text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 text-brand-300 border-brand-500/40">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            Oracle 23ai Security Active
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shrink-0 select-none ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-glow-brand'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab: Security & Devices */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* 2FA Status Notice */}
            <div className="aurora-glass rounded-2xl p-5 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-brand-400" />
                  <div>
                    <h2 className="text-sm font-bold text-white">Two-Factor Authentication (2FA)</h2>
                    <p className="text-[11px] text-slate-400">TOTP Authenticator app verification</p>
                  </div>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${
                  securityStatus?.mfaEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {securityStatus?.mfaEnabled ? 'Enabled' : 'Not Configured'}
                </span>
              </div>

              <div className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2.5 text-xs text-slate-300">
                <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <span>
                  Two-Factor Authentication requires a verified server-side TOTP service and encryption key. Server-side MFA is currently unconfigured in this production release.
                </span>
              </div>
            </div>

            {/* Active Sessions */}
            <div className="aurora-glass rounded-2xl p-5 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-aurora-cyan" />
                  <div>
                    <h2 className="text-sm font-bold text-white">Active Device Sessions</h2>
                    <p className="text-[11px] text-slate-400">Authenticated refresh tokens recorded in Oracle Database</p>
                  </div>
                </div>
              </div>

              {sessionActionMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400">
                  {sessionActionMsg}
                </div>
              )}

              {isSessionsLoading ? (
                <p className="text-xs text-slate-400 py-4 text-center">Loading active sessions from database...</p>
              ) : sessions.length === 0 ? (
                <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
                  Current browser session active. No auxiliary refresh tokens recorded.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sessions.map((session, idx) => {
                    const sid = session.sessionId || session.id || idx;
                    return (
                      <div
                        key={String(sid)}
                        className="flex items-center justify-between p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-200 flex items-center gap-2">
                            {session.device || 'Active Session'}
                            {session.current && (
                              <span className="text-[10px] bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full font-bold">
                                Current
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {session.ipAddress ? `IP: ${session.ipAddress} • ` : ''}
                            {session.createdAt ? `Started: ${new Date(session.createdAt).toLocaleDateString()}` : 'Active'}
                          </p>
                        </div>

                        {!session.current && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleRevokeSession(sid)}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Privacy & Permissions */}
        {activeTab === 'privacy' && (
          <div className="aurora-glass rounded-2xl p-5 border border-slate-800 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Lock className="w-4 h-4 text-brand-400" /> Privacy Controls
            </h2>

            {privacySuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 flex items-center gap-2">
                <Check className="w-4 h-4" /> {privacySuccessMsg}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <div>
                  <p className="font-semibold text-slate-100">Private Account</p>
                  <p className="text-[11px] text-slate-400">Only approved followers can view your full posts</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacySettings(prev => ({ ...prev, isPrivate: !prev.isPrivate }))}
                  className={`w-12 h-6 rounded-full transition-colors p-1 relative ${privacySettings.isPrivate ? 'bg-brand-600' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${privacySettings.isPrivate ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <div>
                  <p className="font-semibold text-slate-100">Show Activity Status</p>
                  <p className="text-[11px] text-slate-400">Allow accounts you follow to see when you were last active</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacySettings(prev => ({ ...prev, activityStatusVisible: !prev.activityStatusVisible }))}
                  className={`w-12 h-6 rounded-full transition-colors p-1 relative ${privacySettings.activityStatusVisible ? 'bg-brand-600' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${privacySettings.activityStatusVisible ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <div>
                  <p className="font-semibold text-slate-100">Read Receipts</p>
                  <p className="text-[11px] text-slate-400">Allow others to see when you have read their direct messages</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacySettings(prev => ({ ...prev, readReceiptsEnabled: !prev.readReceiptsEnabled }))}
                  className={`w-12 h-6 rounded-full transition-colors p-1 relative ${privacySettings.readReceiptsEnabled ? 'bg-brand-600' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${privacySettings.readReceiptsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button size="sm" onClick={handleSavePrivacy} isLoading={isSavingPrivacy}>
                Save Privacy Settings
              </Button>
            </div>
          </div>
        )}

        {/* Tab: Moderation & Hidden Words */}
        {activeTab === 'moderation' && (
          <div className="aurora-glass rounded-2xl p-5 border border-slate-800 space-y-5 text-xs">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Filter className="w-4 h-4 text-rose-400" /> Hidden Words & Comment Filters
              </h2>
              <p className="text-[11px] text-slate-400">Comments containing these keywords will be automatically filtered from your posts</p>
            </div>

            <form onSubmit={handleAddHiddenWord} className="flex gap-2">
              <Input
                id="protection-hidden-word"
                placeholder="Enter keyword or phrase to block..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
              />
              <Button type="submit" size="sm" isLoading={isSavingWords}>
                Add Word
              </Button>
            </form>

            <div className="flex flex-wrap gap-2 pt-1">
              {hiddenWords.map((word) => (
                <span
                  key={word}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 flex items-center gap-2 text-xs"
                >
                  <span>{word}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveHiddenWord(word)}
                    className="text-slate-400 hover:text-rose-400 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Wellbeing */}
        {activeTab === 'wellbeing' && (
          <div className="aurora-glass rounded-2xl p-5 border border-slate-800 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Moon className="w-4 h-4 text-indigo-400" /> Digital Wellbeing & Quiet Mode
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <div>
                  <p className="font-semibold text-slate-100">Quiet Mode</p>
                  <p className="text-[11px] text-slate-400">Pause notification alerts and sounds during focused hours</p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuietMode(!quietMode)}
                  className={`w-12 h-6 rounded-full transition-colors p-1 relative ${quietMode ? 'bg-brand-600' : 'bg-slate-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${quietMode ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-100">Break Reminder Interval</p>
                  <span className="text-brand-400 font-bold">{takeBreakMinutes} mins</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="120"
                  step="15"
                  value={takeBreakMinutes}
                  onChange={(e) => setTakeBreakMinutes(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
