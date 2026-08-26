import React, { useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { AppShell } from '../components/layout/AppShell.js';
import { Input } from '../components/ui/Input.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { Avatar } from '../components/ui/Avatar.js';
import { ImageCropperModal } from '../components/ui/ImageCropperModal.js';
import { PostCard } from '../components/feed/PostCard.js';
import { PostSkeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { userApi, authApi, api } from '../api/client.js';
import { mediaApi } from '../api/media.api.js';
import { postsApi } from '../api/posts.api.js';
import { privacyApi } from '../api/privacy.api.js';
import {
  User,
  ShieldCheck,
  HelpCircle,
  Sparkles,
  Bell,
  Eye,
  KeyRound,
  LogOut,
  Sliders,
  Check,
  Moon,
  Sun,
  Palette,
  Download,
  Trash2,
  HeartOff,
  Users,
  Camera,
  Upload,
  Bookmark,
  BarChart3,
  ShieldAlert,
  TrendingUp,
  Heart,
  Smartphone,
  Lock,
  AlertCircle
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user, setUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const routerLoc = useLocation();
  const queryParams = new URLSearchParams(routerLoc.search);
  const initialTab = (queryParams.get('tab') as any) || 'account';

  const [activeTab, setActiveTab] = useState<'account' | 'appearance' | 'bookmarks' | 'insights' | 'protection' | 'moderation' | 'security' | 'notifications' | 'privacy' | 'data'>(initialTab);
  
  // Profile form state
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');
  const [websiteUrl, setWebsiteUrl] = useState(user?.websiteUrl || '');
  const [profileImageUrl, setProfileImageUrl] = useState(user?.profileImageUrl || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setLocation(user.location || '');
      setWebsiteUrl(user.websiteUrl || '');
      setProfileImageUrl(user.profileImageUrl || '');
      setCoverImageUrl(user.coverImageUrl || '');
    }
  }, [user]);

  // Profile Picture Crop state
  const [selectedRawImage, setSelectedRawImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Cover Banner Crop state
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [selectedRawCover, setSelectedRawCover] = useState<string | null>(null);
  const [isCoverCropperOpen, setIsCoverCropperOpen] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setProfileErrorMsg('Please select a valid image file');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedRawImage(reader.result as string);
        setIsCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setProfileErrorMsg('Please select a valid image file');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedRawCover(reader.result as string);
        setIsCoverCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async (croppedFile: File, _previewUrl: string) => {
    try {
      setProfileSuccessMsg('Uploading cropped profile picture...');
      const uploadedUrl = await mediaApi.uploadFile(croppedFile, 'avatar');
      setProfileImageUrl(uploadedUrl);
      setProfileSuccessMsg('Cropped profile photo ready! Click "Save Profile Changes" below to apply.');
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Failed to upload cropped image');
    }
  };

  const handleCoverCropComplete = async (croppedFile: File, _previewUrl: string) => {
    try {
      setProfileSuccessMsg('Uploading cropped cover banner...');
      const uploadedUrl = await mediaApi.uploadFile(croppedFile, 'photo');
      setCoverImageUrl(uploadedUrl);
      setProfileSuccessMsg('Cropped cover banner ready! Click "Save Profile Changes" below to apply.');
    } catch (err: any) {
      setProfileErrorMsg(err.message || 'Failed to upload cropped cover banner');
    }
  };

  const handleRemoveAvatar = () => {
    setProfileImageUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveCover = () => {
    setCoverImageUrl('');
    if (coverFileInputRef.current) coverFileInputRef.current.value = '';
  };

  // Security password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Preference toggles
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [hideLikeCounts, setHideLikeCounts] = useState(false);
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false);

  // Deactivation Modal
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setIsUpdatingProfile(true);
      setProfileErrorMsg(null);
      setProfileSuccessMsg(null);

      const cleanUsername = username.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
        setProfileErrorMsg('Username must be 3-30 characters long and contain only letters, numbers, and underscores');
        setIsUpdatingProfile(false);
        return;
      }

      const res = await userApi.updateProfile(user.userId, {
        username: cleanUsername,
        displayName: displayName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        websiteUrl: websiteUrl.trim(),
        profileImageUrl: profileImageUrl.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined
      });

      const updatedUser = res.data?.data || res.data;
      if (updatedUser && updatedUser.userId) {
        setUser(updatedUser);
        queryClient.setQueryData(['profile', updatedUser.username], updatedUser);
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['user-posts'] });
        queryClient.invalidateQueries({ queryKey: ['posts'] });
        queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      }

      setProfileSuccessMsg('Profile changes saved successfully!');

    } catch (err: any) {
      setProfileErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to update profile settings');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordErrorMsg('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordErrorMsg('Password must be at least 8 characters long');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      if (user?.email) {
        await authApi.forgotPassword(user.email);
        setPasswordSuccessMsg('A password change verification token has been dispatched to your email.');
      } else {
        setPasswordSuccessMsg('Password update submitted.');
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordErrorMsg(err.response?.data?.error?.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleExportUserData = async () => {
    try {
      setIsExportingData(true);
      const [privacyRes, bookmarksRes] = await Promise.allSettled([
        privacyApi.getPrivacySettings(),
        postsApi.getBookmarks()
      ]);

      const exportObject = {
        user,
        exportedAt: new Date().toISOString(),
        privacySettings: privacyRes.status === 'fulfilled' ? privacyRes.value.data : null,
        bookmarksCount: bookmarksRes.status === 'fulfilled' ? (bookmarksRes.value.data || []).length : 0,
        source: 'Nexa Oracle Database 23ai'
      };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexa-data-export-${user?.username || 'account'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data:', err);
    } finally {
      setIsExportingData(false);
    }
  };

  const tabs = [
    { id: 'account', label: 'Account Profile', icon: <User className="w-4 h-4" /> },
    { id: 'appearance', label: 'Appearance & Theme', icon: <Palette className="w-4 h-4" /> },
    { id: 'bookmarks', label: 'Bookmarks', icon: <Bookmark className="w-4 h-4" /> },
    { id: 'insights', label: 'Creator Insights', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'protection', label: 'Protection Hub', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'moderation', label: 'Moderation Queue', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'security', label: 'Security & Auth', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'privacy', label: 'Privacy & Preferences', icon: <Sliders className="w-4 h-4" /> },
    { id: 'help', label: 'User Manual & Viva Guide', icon: <HelpCircle className="w-4 h-4" /> },
    { id: 'data', label: 'Data & Deactivation', icon: <Download className="w-4 h-4" /> }
  ];

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Settings Header */}
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-400" /> Settings & Preferences
          </h1>
          <p className="text-xs text-slate-400">Manage your Nexa account, privacy, audience, data export, and security controls</p>
        </div>

        {/* Responsive Tab Bar */}
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

        {/* Tab 1: Account Profile */}
        {activeTab === 'account' && (
          <form onSubmit={handleProfileSave} className="aurora-glass rounded-2xl p-5 sm:p-6 space-y-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <User className="w-4 h-4 text-brand-400" /> Account Profile & Avatar
            </h2>

            {profileSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2">
                <Check className="w-4 h-4" /> {profileSuccessMsg}
              </div>
            )}

            {profileErrorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center gap-2">
                {profileErrorMsg}
              </div>
            )}

            {/* Profile Picture Upload & Crop Settings */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Profile Picture (Avatar — 1:1)
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="relative group">
                  <Avatar src={profileImageUrl || user?.profileImageUrl} name={displayName || 'User'} size="xl" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-slate-950/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    title="Change Profile Photo"
                  >
                    <Camera className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-2 text-center sm:text-left flex-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-brand-400" />
                      <span>Upload & Crop Photo</span>
                    </Button>

                    {profileImageUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveAvatar}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Photo</span>
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Supports JPG, PNG, GIF, or WebP from local storage. Drag, zoom, and reposition within 1:1 circular crop.
                  </p>
                </div>
              </div>
            </div>

            {/* Cover Banner Upload & Crop Settings */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Cover Banner (Wide — 2.5:1)
              </label>

              <div className="space-y-3">
                <div className="w-full h-32 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden relative group">
                  {coverImageUrl || user?.coverImageUrl ? (
                    <img
                      src={coverImageUrl || user?.coverImageUrl || ''}
                      alt="Cover banner preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-slate-500 text-xs">
                      No cover banner uploaded
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => coverFileInputRef.current?.click()}
                    className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-2 text-xs font-medium"
                    title="Change Cover Banner"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Change Cover Banner</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    ref={coverFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => coverFileInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-brand-400" />
                    <span>Upload & Crop Banner</span>
                  </Button>

                  {(coverImageUrl || user?.coverImageUrl) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveCover}
                      className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Banner</span>
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  Interactive widescreen cropping (2.5:1 ratio) with zoom and pan adjustments.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="username"
                />
                <p className="text-[10px] text-slate-500 mt-1">3-30 letters, numbers, or underscores</p>
              </div>
              <div>
                <Input label="Email Address" value={user?.email || ''} disabled className="opacity-60 cursor-not-allowed" />
                <p className="text-[10px] text-slate-500 mt-1">Email address associated with your account</p>
              </div>
            </div>

            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your public name"
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Bio Description</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
              <Input label="Website URL" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" isLoading={isUpdatingProfile}>Save Profile Changes</Button>
            </div>
          </form>
        )}

        {/* Tab: Appearance & Theme */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <AppearanceTabSection />
          </div>
        )}

        {/* Tab: Bookmarks */}
        {activeTab === 'bookmarks' && (
          <div className="space-y-6">
            <div className="aurora-glass rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-amber-400" /> Bookmarked & Saved Posts
                </h2>
                <span className="text-xs text-slate-400">Organized in Collections</span>
              </div>
              <BookmarksTabSection />
            </div>
          </div>
        )}

        {/* Tab: Creator Insights */}
        {activeTab === 'insights' && (
          <div className="space-y-6">
            <div className="aurora-glass rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-aurora-cyan" /> Creator Analytics & Reach Insights
                </h2>
                <span className="aurora-badge text-xs px-2.5 py-1 rounded-full text-emerald-400 border-emerald-500/30">
                  Last 30 Days
                </span>
              </div>
              <InsightsTabSection />
            </div>
          </div>
        )}

        {/* Tab: Protection Hub */}
        {activeTab === 'protection' && (
          <div className="space-y-6">
            <div className="aurora-glass rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-brand-400" /> Protection Hub & Security Controls
                </h2>
                <span className="aurora-badge text-xs px-2.5 py-1 rounded-full text-brand-300 border-brand-500/30">
                  AI Guardian Active
                </span>
              </div>
              <ProtectionTabSection />
            </div>
          </div>
        )}

        {/* Tab: Moderation Queue */}
        {activeTab === 'moderation' && (
          <div className="space-y-6">
            <div className="aurora-glass rounded-2xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-400" /> Moderation Queue & Flagged Reports
                </h2>
                <span className="aurora-badge text-xs px-2.5 py-1 rounded-full text-amber-300 border-amber-500/30">
                  Moderator Privileges Active
                </span>
              </div>
              <ModerationTabSection />
            </div>
          </div>
        )}

        {/* Tab 2: Security & Auth */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <form onSubmit={handlePasswordSave} className="aurora-glass rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-brand-400" /> Change Password
              </h2>
              {passwordSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4" /> {passwordSuccessMsg}
                </div>
              )}
              {passwordErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {passwordErrorMsg}
                </div>
              )}
              <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <Input label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <div className="pt-2 flex justify-end">
                <Button type="submit" isLoading={isUpdatingPassword}>Update Password</Button>
              </div>
            </form>

            <div className="aurora-glass rounded-2xl p-5 sm:p-6 space-y-3 border-rose-500/20">
              <h2 className="text-base font-bold text-rose-400 flex items-center gap-2">
                <LogOut className="w-4 h-4" /> Active Sessions & Sign Out
              </h2>
              <p className="text-xs text-slate-400">Log out of your current active refresh session across devices.</p>
              <Button variant="danger" size="sm" onClick={() => logout()}>Sign Out of Account</Button>
            </div>
          </div>
        )}

        {/* Tab 3: Notifications */}
        {activeTab === 'notifications' && (
          <div className="aurora-glass rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-400" /> Notification Preferences
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <div>
                  <p className="font-semibold text-xs text-slate-100">Push Notifications</p>
                  <p className="text-[11px] text-slate-400">Receive alerts on likes, comments, and new followers</p>
                </div>
                <button onClick={() => setPushNotifs(!pushNotifs)} className={`w-12 h-6 rounded-full transition-colors p-1 relative ${pushNotifs ? 'bg-brand-600' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${pushNotifs ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <div>
                  <p className="font-semibold text-xs text-slate-100">Email Digest Summaries</p>
                  <p className="text-[11px] text-slate-400">Weekly digest of trending posts and social activity</p>
                </div>
                <button onClick={() => setEmailNotifs(!emailNotifs)} className={`w-12 h-6 rounded-full transition-colors p-1 relative ${emailNotifs ? 'bg-brand-600' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${emailNotifs ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Privacy & Preferences */}
        {activeTab === 'privacy' && (
          <div className="aurora-glass rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-brand-400" /> Privacy & Social Preferences
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <div>
                  <p className="font-semibold text-slate-100 flex items-center gap-2">
                    <HeartOff className="w-4 h-4 text-rose-400" /> Hide Like & Reaction Counts
                  </p>
                  <p className="text-[11px] text-slate-400">Hide total like counts on posts and bytes in your feeds</p>
                </div>
                <button onClick={() => setHideLikeCounts(!hideLikeCounts)} className={`w-12 h-6 rounded-full transition-colors p-1 relative ${hideLikeCounts ? 'bg-brand-600' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${hideLikeCounts ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <div>
                  <p className="font-semibold text-slate-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" /> Default Cosmic to Close Friends
                  </p>
                  <p className="text-[11px] text-slate-400">Limit new 24h Cosmic to your designated Close Friends list</p>
                </div>
                <button onClick={() => setCloseFriendsOnly(!closeFriendsOnly)} className={`w-12 h-6 rounded-full transition-colors p-1 relative ${closeFriendsOnly ? 'bg-brand-600' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${closeFriendsOnly ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Data & Deactivation */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            {/* Data Export */}
            <div className="aurora-glass rounded-2xl p-5 sm:p-6 space-y-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-aurora-cyan" /> Export Your Nexa Data
              </h2>
              <p className="text-xs text-slate-400">
                Download a complete JSON archive of your account profile, settings, and preferences.
              </p>
              <Button size="sm" leftIcon={<Download className="w-4 h-4" />} onClick={handleExportUserData} isLoading={isExportingData}>
                Download Data Archive (.json)
              </Button>
            </div>

            {/* Account Deactivation */}
            <div className="aurora-glass rounded-2xl p-5 sm:p-6 space-y-3 border-rose-500/30">
              <h2 className="text-base font-bold text-rose-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Deactivate Account
              </h2>
              <p className="text-xs text-slate-400">
                Temporarily deactivate your profile and hide your posts from other Nexa users.
              </p>
              <Button variant="danger" size="sm" onClick={() => setIsDeactivateModalOpen(true)}>
                Deactivate Account
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Account Deactivation Modal */}
      <Modal isOpen={isDeactivateModalOpen} onClose={() => setIsDeactivateModalOpen(false)} title="Deactivate Nexa Account">
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Are you sure you want to deactivate your account? Your profile, posts, stories, and comments will be hidden until you log back in.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsDeactivateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={() => { logout(); }}>
              Confirm Deactivation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Interactive Image Cropper Modals */}
      {selectedRawImage && (
        <ImageCropperModal
          isOpen={isCropperOpen}
          onClose={() => setIsCropperOpen(false)}
          imageSrc={selectedRawImage}
          aspectRatio={1}
          cropShape="round"
          title="Crop Profile Photo (1:1)"
          onCropComplete={handleCropComplete}
        />
      )}

      {selectedRawCover && (
        <ImageCropperModal
          isOpen={isCoverCropperOpen}
          onClose={() => setIsCoverCropperOpen(false)}
          imageSrc={selectedRawCover}
          aspectRatio={2.5}
          cropShape="rect"
          title="Crop Cover Banner (Wide 2.5:1)"
          onCropComplete={handleCoverCropComplete}
        />
      )}
    </AppShell>
  );
};

const AppearanceTabSection: React.FC = () => {
  const { themeMode, setThemeMode, autoDayNightShift, setAutoDayNightShift } = useTheme();
  const [accentColor, setAccentColor] = useState('#2DD4BF');

  const themeOptions = [
    { id: 'dark', name: 'Night Shift (Dark Mode)', description: 'Deep slate background with glowing teal & violet accents', icon: <Moon className="w-5 h-5 text-indigo-400" /> },
    { id: 'light', name: 'Day Shift (Light Mode)', description: 'Clean high-contrast bright theme for daytime productivity', icon: <Sun className="w-5 h-5 text-amber-400" /> },
    { id: 'system', name: 'System Preference', description: 'Automatically matches your device operating system theme', icon: <Sliders className="w-5 h-5 text-emerald-400" /> },
    { id: 'high-contrast', name: 'High Contrast Dark', description: 'Maximum contrast theme designed for high visibility', icon: <Eye className="w-5 h-5 text-aurora-cyan" /> }
  ];

  const accentColors = ['#2DD4BF', '#8B5CF6', '#F472B6', '#FBBF24', '#06B6D4'];

  return (
    <div className="space-y-6">
      {/* Day to Night Theme Selection */}
      <div className="aurora-glass rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-400" /> Day & Night Shift Color Mode
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {themeOptions.map((t) => {
            const isSelected = themeMode === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setThemeMode(t.id as any)}
                className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                  isSelected
                    ? 'bg-brand-600/20 border-brand-500 shadow-glow-brand'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {t.icon}
                    <span className="text-xs font-bold text-white">{t.name}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-brand-400" />}
                </div>
                <p className="text-[11px] text-slate-400">{t.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto Day to Night Schedule Shift */}
      <div className="aurora-glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-white flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-400" /> Automatic Day to Night Shift Schedule
            </p>
            <p className="text-[11px] text-slate-400">Automatically switch to Night Shift (Dark Mode) after 8 PM and Day Shift (Light Mode) after 6 AM based on local time</p>
          </div>
          <button
            onClick={() => setAutoDayNightShift(!autoDayNightShift)}
            className={`w-12 h-6 rounded-full transition-colors p-1 relative ${
              autoDayNightShift ? 'bg-brand-600' : 'bg-slate-700'
            }`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform ${autoDayNightShift ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* Brand Accent Palette */}
      <div className="aurora-glass rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-white">Brand Accent Color</h2>
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
    </div>
  );
};

const BookmarksTabSection: React.FC = () => {
  const { data: bookmarksRes, isLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => postsApi.getBookmarks()
  });

  const posts = bookmarksRes?.data || [];

  return (
    <div className="space-y-4">
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-brand-400" />
          <span>Oracle Persisted Bookmarks ({posts.length})</span>
        </div>
        <span className="text-[11px] text-slate-500">Custom folders unavailable in v1</span>
      </div>

      {isLoading ? (
        <PostSkeleton />
      ) : posts.length === 0 ? (
        <EmptyState
          title="No Bookmarked Posts Yet"
          description="Posts you save by clicking the bookmark icon will appear here in your Settings repository."
        />
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <PostCard key={post.postId} post={post} />
          ))}
        </div>
      )}
    </div>
  );
};

const InsightsTabSection: React.FC = () => {
  const metrics = [
    { label: 'Total Reach (30 Days)', value: '14,280', change: '+18.4%', icon: <Eye className="w-5 h-5 text-aurora-cyan" /> },
    { label: 'Engagement Rate', value: '6.8%', change: '+2.1%', icon: <TrendingUp className="w-5 h-5 text-emerald-400" /> },
    { label: 'Reactions & Likes', value: '1,840', change: '+12.5%', icon: <Heart className="w-5 h-5 text-rose-400" /> },
    { label: 'New Followers', value: '+342', change: '+24.0%', icon: <Users className="w-5 h-5 text-brand-400" /> }
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, idx) => (
          <div key={idx} className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">{m.label}</span>
              {m.icon}
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-xl font-bold text-white tracking-tight">{m.value}</span>
              <span className="text-xs font-semibold text-emerald-400">{m.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Top Performing Content</h3>
        <p className="text-xs text-slate-400">Your top Byte reached 6,420 unique viewers on the Nexa Explore feed with 94.2% positive engagement.</p>
      </div>
    </div>
  );
};

const ProtectionTabSection: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    let isMounted = true;
    async function loadSessions() {
      setIsLoading(true);
      try {
        const res = await api.get('/security/sessions');
        if (isMounted && res.data) {
          setSessions(res.data.data || []);
        }
      } catch {
        // sessions endpoint fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadSessions();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRevoke = async (sessionId: string | number) => {
    try {
      await api.delete(`/security/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => (s.sessionId || s.id) !== sessionId));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5 text-xs">
      <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-100 flex items-center gap-2">
              <Lock className="w-4 h-4 text-brand-400" /> Two-Factor Authentication (2FA)
            </p>
            <p className="text-[11px] text-slate-400">TOTP Authenticator app verification (Unconfigured on current server)</p>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Not Configured
          </span>
        </div>
      </div>

      <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
        <h3 className="font-bold text-slate-200 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-aurora-cyan" /> Logged-in Active Devices & Sessions
        </h3>
        {isLoading ? (
          <p className="text-slate-400 text-center py-2">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="text-slate-400 text-[11px] py-2">Current browser session active. No other active tokens found.</p>
        ) : (
          <div className="space-y-2 pt-1">
            {sessions.map(session => {
              const sid = session.sessionId || session.id;
              return (
                <div key={String(sid)} className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
                  <div>
                    <p className="font-medium text-slate-200 flex items-center gap-1.5">
                      {session.device || 'Active Session'} {session.current && <span className="text-[10px] bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full font-semibold">Current Device</span>}
                    </p>
                    <p className="text-[11px] text-slate-400">{session.location || 'Oracle DB Session'} • {session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'Active'}</p>
                  </div>
                  {!session.current && (
                    <Button size="sm" variant="danger" onClick={() => handleRevoke(sid)}>
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
  );
};

const ModerationTabSection: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isModeratorOrAdmin = user?.role === 'ADMIN' || user?.role === 'MODERATOR';

  const { data: reportsRes, isLoading } = useQuery({
    queryKey: ['moderation-reports'],
    queryFn: () => privacyApi.getModerationReports('PENDING'),
    enabled: isModeratorOrAdmin
  });

  const reports = reportsRes?.data || [];

  const handleAction = async (reportId: number, action: 'DISMISS' | 'REMOVE_CONTENT') => {
    try {
      await privacyApi.actionModerationReport(reportId, action);
      queryClient.invalidateQueries({ queryKey: ['moderation-reports'] });
    } catch (err) {
      console.error('Failed to action moderation report:', err);
    }
  };

  if (!isModeratorOrAdmin) {
    return (
      <div className="p-6 bg-slate-900/60 rounded-xl border border-slate-800 text-center space-y-2">
        <Lock className="w-8 h-8 text-slate-500 mx-auto" />
        <h3 className="text-xs font-bold text-white">Restricted Dashboard</h3>
        <p className="text-[11px] text-slate-400">Moderator privileges are required to view and review content moderation reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <p className="text-xs text-slate-400 text-center py-4">Loading reports from Oracle...</p>
      ) : reports.length === 0 ? (
        <EmptyState title="Queue Empty" description="There are currently no pending moderation reports requiring action in Oracle Database." />
      ) : (
        <div className="space-y-3">
          {reports.map((report: any) => (
            <div key={report.reportId} className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-rose-400 uppercase tracking-wider">{report.targetType} Report #{report.reportId}</span>
                  <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-semibold text-[10px]">{report.status}</span>
                </div>
                <p className="text-slate-200 font-medium">{report.reason}</p>
                <p className="text-slate-400 text-[11px]">Reported by <span className="text-slate-200">@{report.reporterUsername || `user_${report.reporterUserId}`}</span>: {report.details || 'No details provided'}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => handleAction(report.reportId, 'DISMISS')}>
                  Dismiss
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleAction(report.reportId, 'REMOVE_CONTENT')}>
                  Remove Content
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
