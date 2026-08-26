import React, { useState } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { 
  HelpCircle, 
  Search, 
  UserPlus, 
  Edit3, 
  MessageSquare, 
  ShieldAlert,
  BookOpen,
  Settings,
  Smartphone,
  ArrowRight,
  Users,
  Radio,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ANDROID_RELEASE } from '../config/androidRelease.js';

export const HelpPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<'all' | 'getting-started' | 'messaging' | 'security' | 'android'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'all', label: 'All Guides' },
    { id: 'getting-started', label: '🚀 Getting Started' },
    { id: 'messaging', label: '💬 Messages & Groups' },
    { id: 'security', label: '🔒 Privacy & Security' },
    { id: 'android', label: '📱 Android Mobile App' }
  ];

  const guideCards = [
    {
      id: 'account-setup',
      category: 'getting-started',
      title: 'Creating an Account & Profile Setup',
      icon: UserPlus,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      steps: [
        'Click "Sign Up" on the Nexa homepage or login screen.',
        'Enter your desired username, email address, and strong password.',
        'Navigate to your Profile page to upload an avatar image, bio, and location.',
        'Start following other Nexa members to populate your personalized feed.'
      ],
      actionText: 'Update Profile',
      actionTarget: '/profile'
    },
    {
      id: 'creating-posts',
      category: 'getting-started',
      title: 'Publishing Posts & Interacting',
      icon: Edit3,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      steps: [
        'Click "Create Post" in the sidebar or floating action button.',
        'Type your text update (up to 2,200 characters).',
        'Optionally upload high-resolution images or media.',
        'Tap the Heart icon to like, Comment to join discussion, or Bookmark to save for later.'
      ],
      actionText: 'Explore Feed',
      actionTarget: '/explore'
    },
    {
      id: 'direct-messages',
      category: 'messaging',
      title: '1-on-1 Direct Messages',
      icon: MessageSquare,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      steps: [
        'Open the Messages tab from the sidebar navigation.',
        'Select any contact to open a private direct chat channel.',
        'All direct messages are transmitted securely over TLS (HTTPS and WSS) connections.',
        'Real-time typing indicators and read receipts keep your conversations synchronized.'
      ],
      actionText: 'Open Messages',
      actionTarget: '/messages'
    },
    {
      id: 'group-chats',
      category: 'messaging',
      title: 'Creating & Managing Group Chats',
      icon: Users,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      steps: [
        'In the Messages page, click the "+ Group" button in the top bar.',
        'Enter a Group Name and optional description.',
        'Search and select multiple contact members using checkboxes.',
        'Click "Create Group" to start real-time multi-user team conversations.'
      ],
      actionText: 'Create Group',
      actionTarget: '/messages'
    },
    {
      id: 'broadcast-lists',
      category: 'messaging',
      title: 'Sending Broadcast Messages',
      icon: Radio,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      steps: [
        'In Messages, click the "Broadcast" button in the top action bar.',
        'Select multiple contacts who should receive the broadcast.',
        'Write your broadcast announcement and click "Dispatch".',
        'Each recipient receives your announcement as a private 1-on-1 direct message.'
      ],
      actionText: 'New Broadcast',
      actionTarget: '/messages'
    },
    {
      id: 'privacy-explained',
      category: 'security',
      title: 'Protection Center & Security Logs',
      icon: ShieldAlert,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      steps: [
        'Visit the Protection Center to review active sessions, login history, and device IPs.',
        'Enable 2FA and download backup recovery codes for secure emergency access.',
        'Revoke compromised sessions instantly with one click.',
        'Manage end-to-end encryption keys and rotate them when needed.'
      ],
      actionText: 'Protection Center',
      actionTarget: '/protection'
    },
    {
      id: 'user-manual-overview',
      category: 'getting-started',
      title: 'Interactive User Manual & Platform Guide',
      icon: BookOpen,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      steps: [
        'Comprehensive guide covering feed algorithms, hashtag trends, and bookmarking.',
        'Instructions for creating and broadcasting in Group Channels.',
        'Guidelines for uploading HD reels, applying filters, and tagging users.',
        'Detailed steps on privacy controls, block lists, and muted accounts.'
      ],
      actionText: 'View Manual',
      actionTarget: '/user-manual'
    },
    {
      id: 'settings-customization',
      category: 'getting-started',
      title: 'Account Settings & Themes',
      icon: Settings,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
      steps: [
        'Toggle between Neon Cyberpunk, Sleek Midnight, and Emerald Dark themes.',
        'Update your avatar, bio, location, website URL, and cover background.',
        'Configure email notifications and alert preferences.',
        'Export your personal data archive or delete your account.'
      ],
      actionText: 'Open Settings',
      actionTarget: '/settings'
    },
    {
      id: 'android-app-guide',
      category: 'android',
      title: 'Using the Nexa Android Application',
      icon: Smartphone,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      steps: [
        'Enjoy native Android bottom navigation across Home, Explore, Messages, Bytes, and Profile.',
        'Secure credentials are encrypted locally using Android Keystore and EncryptedSharedPreferences.',
        'Receive instant real-time message delivery and typing indicators over WebSocket.',
        'Explore Bytes, Cosmic, and global trends on any Android device.'
      ],
      actionText: 'Download APK',
      actionTarget: ANDROID_RELEASE.downloadUrl
    }
  ];

  const filteredCards = guideCards.filter((card) => {
    const matchesCategory = activeCategory === 'all' || card.category === activeCategory;
    const matchesSearch = 
      card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.steps.some(step => step.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950/40 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-500/20 border border-brand-500/30 rounded-full text-brand-300 text-xs font-semibold">
            <HelpCircle className="w-4 h-4" /> Help Center & Knowledge Base
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            How Nexa Works: Interactive User Guide
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
            Welcome to Nexa Social! Learn how to share updates, send secure direct messages, manage group chats, dispatch broadcasts, and use our Android mobile app.
          </p>

          {/* Search Box */}
          <div className="relative max-w-md pt-2">
            <Search className="w-4 h-4 absolute left-3.5 top-5.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tutorials & topics..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none shadow-inner"
            />
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                activeCategory === cat.id
                  ? 'bg-brand-600 text-white shadow-glow-brand'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Interactive Guide Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredCards.length === 0 ? (
            <div className="col-span-2 p-12 text-center text-sm text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl">
              No matching tutorials found. Try a different search query.
            </div>
          ) : (
            filteredCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  className="bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 flex flex-col justify-between space-y-4 transition-all shadow-sm"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={`p-2.5 rounded-xl border ${card.bg} ${card.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-white tracking-tight">{card.title}</h3>

                    <ul className="space-y-2 pt-1">
                      {card.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                          <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => navigate(card.actionTarget)}
                      className="w-full px-4 py-2 bg-slate-800/60 hover:bg-brand-600 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 group"
                    >
                      <span>{card.actionText}</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
};
