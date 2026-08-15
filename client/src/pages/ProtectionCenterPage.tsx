import React, { useState } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { useAuth } from '../contexts/AuthContext.js';
import { 
  ShieldCheck, 
  KeyRound, 
  Smartphone, 
  EyeOff, 
  UserX, 
  Filter, 
  Moon, 
  AlertTriangle, 
  Check, 
  RefreshCw, 
  Lock, 
  Copy, 
  BellRing,
  Sparkles
} from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';

export const ProtectionCenterPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'security' | 'privacy' | 'moderation' | 'wellbeing'>('security');

  // 2FA state
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [secretKey, setSecretKey] = useState('NEXA-7X9K-3P2M-8W4Q');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Active Sessions
  const [activeSessions, setActiveSessions] = useState([
    { id: 1, device: 'Chrome on Windows 11', location: 'San Francisco, US', lastActive: 'Active now', current: true },
    { id: 2, device: 'Nexa iOS App on iPhone 15', location: 'Tokyo, JP', lastActive: '2 hours ago', current: false }
  ]);

  // Privacy & Follow Requests
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);
  const [followRequests, setFollowRequests] = useState([
    { id: 101, username: 'dev_marcus', displayName: 'Marcus Vance', time: '10m ago' }
  ]);

  // Moderation: Blocked Users & Hidden Words
  const [blockedUsers, setBlockedUsers] = useState([
    { id: 201, username: 'spambot_99', displayName: 'Spam Bot 99' }
  ]);
  const [newKeyword, setNewKeyword] = useState('');
  const [hiddenWords, setHiddenWords] = useState(['crypto_spam', 'buy_followers', 'scam_link']);

  // Wellbeing
  const [quietMode, setQuietMode] = useState(false);
  const [takeBreakMinutes, setTakeBreakMinutes] = useState(30);

  const handleGenerateRecoveryCodes = () => {
    setIsGeneratingCodes(true);
    setTimeout(() => {
      const codes = Array.from({ length: 8 }, () => Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase());
      setRecoveryCodes(codes);
      setIsGeneratingCodes(false);
      setCopiedCodes(false);
    }, 400);
  };

  const handleRevokeSession = (sessionId: number) => {
    setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const handleUnblockUser = (userId: number) => {
    setBlockedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleAddHiddenWord = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyword.trim() && !hiddenWords.includes(newKeyword.trim().toLowerCase())) {
      setHiddenWords([...hiddenWords, newKeyword.trim().toLowerCase()]);
      setNewKeyword('');
    }
  };

  const handleRemoveHiddenWord = (word: string) => {
    setHiddenWords(prev => prev.filter(w => w !== word));
  };

  const tabs = [
    { id: 'security', label: '2FA & Devices', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy & Requests', icon: <Lock className="w-4 h-4" /> },
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
              <div className="p-2 bg-gradient-to-tr from-brand-600 to-aurora-cyan rounded-xl text-white shadow-glow-brand">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">Nexa Protection Center</h1>
            </div>
            <p className="text-xs text-slate-300">
              Manage multi-factor authentication, active devices, privacy, content safety filters, and quiet mode wellbeing.
            </p>
          </div>
          <span className="aurora-badge text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Protection Active
          </span>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex border-b border-slate-800/80 gap-2 overflow-x-auto pb-1 scrollbar-none">
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

        {/* TAB 1: 2FA & Devices */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* 2FA Toggle & Key */}
            <div className="aurora-glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-brand-400" /> Two-Factor Authentication (2FA)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Require an authenticator app (TOTP) security code on every new sign in.
                  </p>
                </div>
                <button
                  onClick={() => setIs2FAEnabled(!is2FAEnabled)}
                  className={`w-12 h-6 rounded-full transition-colors p-1 relative ${
                    is2FAEnabled ? 'bg-brand-600' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${is2FAEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {is2FAEnabled && (
                <div className="p-4 bg-slate-900/80 rounded-xl border border-brand-500/30 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">TOTP Authenticator Secret Key:</span>
                    <code className="text-brand-300 font-mono bg-black/40 px-2 py-1 rounded border border-brand-500/20">{secretKey}</code>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-200">Backup Recovery Codes</p>
                      <p className="text-[11px] text-slate-400">Use one-time codes if you lose access to your authenticator app</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleGenerateRecoveryCodes} isLoading={isGeneratingCodes}>
                      Generate Codes
                    </Button>
                  </div>

                  {recoveryCodes.length > 0 && (
                    <div className="p-3 bg-black/40 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-300">8 One-Time Backup Codes:</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(recoveryCodes.join('\n'));
                            setCopiedCodes(true);
                          }}
                          className="text-xs text-brand-400 hover:underline flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" /> {copiedCodes ? 'Copied!' : 'Copy All'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-cyan-300">
                        {recoveryCodes.map((code, idx) => (
                          <div key={idx} className="p-1.5 bg-slate-900 rounded text-center border border-slate-800">{code}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Active Devices & Sessions */}
            <div className="aurora-glass rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-aurora-cyan" /> Active Sessions & Devices
              </h3>
              <p className="text-xs text-slate-400">
                Logged in devices with active refresh sessions. Revoke any session you do not recognize.
              </p>

              <div className="space-y-3">
                {activeSessions.map((session) => (
                  <div key={session.id} className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-2">
                        {session.device} {session.current && <span className="text-[10px] bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full border border-brand-500/30">Current Device</span>}
                      </p>
                      <p className="text-[11px] text-slate-400">{session.location} • {session.lastActive}</p>
                    </div>
                    {!session.current && (
                      <Button size="sm" variant="danger" onClick={() => handleRevokeSession(session.id)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Privacy & Requests */}
        {activeTab === 'privacy' && (
          <div className="space-y-6">
            <div className="aurora-glass rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Lock className="w-5 h-5 text-aurora-pink" /> Private Account Mode
                  </h3>
                  <p className="text-xs text-slate-400">
                    When enabled, only users you approve as followers can see your profile posts and stories.
                  </p>
                </div>
                <button
                  onClick={() => setIsPrivateAccount(!isPrivateAccount)}
                  className={`w-12 h-6 rounded-full transition-colors p-1 relative ${
                    isPrivateAccount ? 'bg-brand-600' : 'bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isPrivateAccount ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Pending Follow Requests Queue */}
            <div className="aurora-glass rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserX className="w-5 h-5 text-brand-400" /> Pending Follow Requests ({followRequests.length})
              </h3>

              {followRequests.length === 0 ? (
                <p className="text-xs text-slate-500">No pending follow requests.</p>
              ) : (
                <div className="space-y-3">
                  {followRequests.map((req) => (
                    <div key={req.id} className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-white">{req.displayName}</p>
                        <p className="text-[11px] text-slate-400">@{req.username} • {req.time}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => setFollowRequests(prev => prev.filter(r => r.id !== req.id))}>
                          Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setFollowRequests(prev => prev.filter(r => r.id !== req.id))}>
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Safety & Hidden Words */}
        {activeTab === 'moderation' && (
          <div className="space-y-6">
            {/* Hidden Words Comment Filter */}
            <div className="aurora-glass rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Filter className="w-5 h-5 text-aurora-cyan" /> Hidden Words & Comment Filter
              </h3>
              <p className="text-xs text-slate-400">
                Comments or replies containing these custom keywords or offensive phrases will be automatically hidden.
              </p>

              <form onSubmit={handleAddHiddenWord} className="flex gap-2">
                <Input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Enter keyword or phrase to block..."
                  className="flex-1"
                />
                <Button type="submit" size="sm">Add Rule</Button>
              </form>

              <div className="flex flex-wrap gap-2 pt-2">
                {hiddenWords.map((word) => (
                  <span key={word} className="px-3 py-1 bg-slate-800 text-slate-200 border border-slate-700 rounded-full text-xs font-medium flex items-center gap-1.5">
                    {word}
                    <button type="button" onClick={() => handleRemoveHiddenWord(word)} className="text-slate-400 hover:text-rose-400 font-bold">×</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Blocked Users */}
            <div className="aurora-glass rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserX className="w-5 h-5 text-rose-400" /> Blocked Accounts ({blockedUsers.length})
              </h3>
              <div className="space-y-2">
                {blockedUsers.map((u) => (
                  <div key={u.id} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{u.displayName}</p>
                      <p className="text-[11px] text-slate-400">@{u.username}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleUnblockUser(u.id)}>
                      Unblock
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Quiet Mode & Wellbeing */}
        {activeTab === 'wellbeing' && (
          <div className="aurora-glass rounded-2xl p-5 space-y-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Moon className="w-5 h-5 text-indigo-400" /> Quiet Mode & Digital Wellbeing
            </h3>
            <p className="text-xs text-slate-400">
              Pause all push notifications during your focus or sleep schedule.
            </p>

            <div className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-brand-400" /> Quiet Hours Schedule
                </p>
                <p className="text-[11px] text-slate-400">Mutes push alerts every day between 10:00 PM and 7:00 AM</p>
              </div>
              <button
                onClick={() => setQuietMode(!quietMode)}
                className={`w-12 h-6 rounded-full transition-colors p-1 relative ${
                  quietMode ? 'bg-brand-600' : 'bg-slate-700'
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform ${quietMode ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
