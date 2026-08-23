import React, { useState } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { DrDoomOrbLogo } from '../components/ui/DrDoomOrbLogo.js';
import { BookOpen, Search, UserPlus, Edit3, MessageSquare, ShieldCheck, Smartphone, ChevronDown, ChevronUp, ArrowRight, Users, CheckCircle2, Camera, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ANDROID_RELEASE } from '../config/androidRelease.js';

interface ManualSection {
  id: string;
  title: string;
  category: string;
  icon: any;
  color: string;
  bg: string;
  summary: string;
  targetRoute: string;
  actionLabel: string;
  steps: { title: string; desc: string }[];
}

export const UserManualPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [openSectionId, setOpenSectionId] = useState<string | null>('getting-started');

  const toggleSection = (id: string) => {
    setOpenSectionId((prev) => (prev === id ? null : id));
  };

  const sections: ManualSection[] = [
    {
      id: 'getting-started',
      title: '1. Getting Started & Account Setup',
      category: 'Account',
      icon: UserPlus,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      summary: 'Learn how to create an account, log in securely, and start using Nexa.',
      targetRoute: '/settings',
      actionLabel: 'Edit Profile Settings',
      steps: [
        {
          title: 'Step 1: Account Registration',
          desc: 'Click "Sign up" on the login screen, enter your username, email, and password, then submit to register.'
        },
        {
          title: 'Step 2: Session Authentication',
          desc: 'Log in with your registered username or email. JWT access tokens (15-min expiry) and HTTP-only refresh tokens will be stored securely.'
        },
        {
          title: 'Step 3: User Dashboard Navigation',
          desc: 'Use the left sidebar navigation (or bottom navigation bar on mobile) to access Home Feed, Explore, Messages, User Manual, Profile, and Settings.'
        }
      ]
    },
    {
      id: 'profile-uploads',
      title: '2. Instagram-Style Profile Photo & Banner Uploads',
      category: 'Profile',
      icon: Camera,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      summary: 'Upload profile photos and cover banners using FormData file streaming and instant previews.',
      targetRoute: '/profile/vash_ofzl',
      actionLabel: 'Open Profile Editor',
      steps: [
        {
          title: 'Step 1: Open Edit Profile Modal',
          desc: 'Navigate to your Profile page and click the "Edit Profile" button to launch the Instagram-style profile editor.'
        },
        {
          title: 'Step 2: Change Profile Photo',
          desc: 'Hover over the circular avatar card and click "Change Photo". Pick a 1:1 square image (JPEG/PNG/WebP). An instant circular preview will display.'
        },
        {
          title: 'Step 3: Change Cover Banner',
          desc: 'Hover over the wide cover banner area and click "Change Banner". Select a wide image (3:1 or 16:9 ratio).'
        },
        {
          title: 'Step 4: Multipart FormData Streaming',
          desc: 'Files stream directly to `/api/media/upload` using FormData. The backend saves static files under `/uploads/` and returns public URLs. No large base64 strings bloat the database.'
        }
      ]
    },
    {
      id: 'posts-and-feed',
      title: '3. Publishing Posts & Feed Management',
      category: 'Feed',
      icon: Edit3,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      summary: 'How to create text and media posts, like, comment, bookmark, and switch feed views.',
      targetRoute: '/explore',
      actionLabel: 'Explore Feed Now',
      steps: [
        {
          title: 'Step 1: Create a Post',
          desc: 'Click "Create Post" at the top of the feed or in the sidebar. Type text up to 2,000 characters and optionally attach media.'
        },
        {
          title: 'Step 2: Like, Comment & Share',
          desc: 'Tap the Heart icon on any post card to like it. Click the Comment icon to open the interactive discussion drawer.'
        },
        {
          title: 'Step 3: Bookmark Posts',
          desc: 'Click the Bookmark icon on any post card to save it to your private bookmarks collection in Settings -> Bookmarks.'
        },
        {
          title: 'Step 4: Global vs Following Feed Tabs',
          desc: 'Use top tabs on Home Feed to switch between global community updates and posts strictly from users you follow.'
        }
      ]
    },
    {
      id: 'progress-media-and-videos',
      title: '4. Progress-Tracked Media & Long Video Uploads',
      category: 'Media',
      icon: Video,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      summary: 'Stream images and videos with live percentage progress bars (0% -> 100%) and automatic duration detection.',
      targetRoute: '/reels',
      actionLabel: 'Upload Reel / Video',
      steps: [
        {
          title: 'Step 1: File Size & Format Validation',
          desc: 'The upload pipeline enforces strict validation: photos up to 50MB and videos up to 500MB (MP4, WebM, MOV, MKV).'
        },
        {
          title: 'Step 2: Real-Time Percentage Progress Bar',
          desc: 'While files stream via `FormData` to `/api/media/upload`, Axios `onUploadProgress` updates a live percentage bar (0% -> 100%).'
        },
        {
          title: 'Step 3: Automatic Video Duration Detection',
          desc: 'When selecting a video file, the system inspects video metadata (`video.duration`):'
        },
        {
          title: 'Short Reels (< 60 seconds)',
          desc: 'Videos under 60 seconds are automatically labeled as "Short Reel" and formatted for vertical 9:16 viewing.'
        },
        {
          title: 'Long Videos (≥ 60 seconds)',
          desc: 'Videos 60 seconds or longer are automatically labeled as "Long Video" with expanded playback controls.'
        }
      ]
    },
    {
      id: 'direct-messages-tls',
      title: '5. Direct Messages & Real-Time Sync',
      category: 'Messaging',
      icon: MessageSquare,
      color: 'text-brand-400',
      bg: 'bg-brand-500/10 border-brand-500/20',
      summary: 'Send 1-on-1 direct messages secured with transport-level encryption and real-time Socket.IO sync.',
      targetRoute: '/messages',
      actionLabel: 'Open Direct Messages',
      steps: [
        {
          title: 'Step 1: Authenticated REST & WebSocket',
          desc: 'Direct messages are transmitted over secure TLS connections directly to the Oracle-backed API gateway.'
        },
        {
          title: 'Step 2: Real-Time Event Dispatch',
          desc: 'Socket.IO delivers new messages instantly to online recipients with read receipts and delivery status.'
        },
        {
          title: 'Step 3: Oracle SQL Persistence',
          desc: 'Conversations are durably persisted in the Oracle MESSAGES repository with sender and recipient indexing.'
        },
        {
          title: 'Step 4: Real-Time Typing Indicators',
          desc: 'When typing in chat, Socket.IO broadcasts debounced typing start/stop events ("User is typing...").'
        }
      ]
    },
    {
      id: 'groups-and-broadcasts',
      title: '6. Group Chats & Message Broadcast Lists',
      category: 'Messaging',
      icon: Users,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      summary: 'Create multi-member team group chats or send announcement broadcasts to multiple recipients.',
      targetRoute: '/messages',
      actionLabel: 'Launch Messaging Suite',
      steps: [
        {
          title: 'Step 1: Create a Group Chat',
          desc: 'In Messages, click "+ Group", enter a Group Name & description, select member contacts, and submit.'
        },
        {
          title: 'Step 2: Real-Time Group Messaging',
          desc: 'Group messages are delivered instantly via Socket.IO to all active group members.'
        },
        {
          title: 'Step 3: Send Broadcast Announcements',
          desc: 'Click "Broadcast", select recipient contacts, write your announcement, and click "Dispatch".'
        },
        {
          title: 'Step 4: WhatsApp-Style Fan-Out',
          desc: 'Broadcasts arrive as individual 1-on-1 direct messages for each recipient without exposing recipient lists.'
        }
      ]
    },
    {
      id: 'security-and-privacy',
      title: '7. Security, Privacy & Academic Viva Reference Guide',
      category: 'Security',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      summary: 'Key technical notes on Oracle SQL database design, Node.js controllers, and security architecture for project viva.',
      targetRoute: '/settings',
      actionLabel: 'Security Settings',
      steps: [
        {
          title: 'Oracle 19c/21c Database Schema',
          desc: 'Primary keys use identity columns (`NUMBER GENERATED BY DEFAULT AS IDENTITY`). Boolean flags use `NUMBER(1) CHECK (col IN (0,1))`.'
        },
        {
          title: 'Layered Backend Architecture',
          desc: 'Strict separation: Routes -> Validation Middleware -> Controller -> Service -> Repository -> Oracle Database.'
        },
        {
          title: 'Sanitized Static Media URLs',
          desc: 'All static uploads resolve via `getMediaUrl(url)` with fallback SVG graphics to prevent broken image links.'
        }
      ]
    },
    {
      id: 'android-app-guide',
      title: '8. Nexa Native Android Mobile Application',
      category: 'Mobile',
      icon: Smartphone,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      summary: 'Features, APK installation, Socket.IO client, push notifications, and offline connectivity.',
      targetRoute: '/help',
      actionLabel: 'Download Android APK',
      steps: [
        {
          title: 'Step 1: Download & Install APK',
          desc: 'Click the "Android App (Download APK)" link in the sidebar or download `nexa-social-app.apk`.'
        },
        {
          title: 'Step 2: Official Socket.IO Java Client',
          desc: 'Integrates `io.socket:socket.io-client:2.1.1` with JWT token handshake authentication for real-time messages.'
        },
        {
          title: 'Step 3: Secure Mobile Communications',
          desc: 'Transmits all messages over TLS-encrypted WebSocket and HTTPS channels with local Keystore credential security.'
        },
        {
          title: 'Step 4: Network Callback Offline Detection',
          desc: 'Monitors Android `ConnectivityManager` callbacks. If connection drops, a native offline state banner displays with auto-reconnect.'
        }
      ]
    }
  ];

  const filteredSections = sections.filter((sec) => sec.title.toLowerCase().includes(searchQuery.toLowerCase()) || sec.summary.toLowerCase().includes(searchQuery.toLowerCase()) || sec.steps.some((st) => st.title.toLowerCase().includes(searchQuery.toLowerCase()) || st.desc.toLowerCase().includes(searchQuery.toLowerCase())));

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
        {/* Header Hero Card with Official Nexa Doom Orb Application Icon */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-500/20 border border-brand-500/30 rounded-full text-brand-300 text-xs font-semibold">
              <BookOpen className="w-4 h-4" /> Nexa User Manual & Project Viva Guide
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Nexa Project User Manual</h1>
            <p className="text-sm text-slate-300 leading-relaxed">Learn how to use Nexa step by step. Explore guides on account setup, Instagram profile uploads, progress-tracked media streaming, short Reels vs Long Videos, TLS-encrypted messaging, group chats, broadcasts, and the Android mobile app.</p>

            {/* Search Box */}
            <div className="relative max-w-md pt-2">
              <Search className="w-4 h-4 absolute left-3.5 top-5.5 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search user manual topics..." className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none shadow-inner" />
            </div>
          </div>

          {/* Official Nexa Application Icon */}
          <div className="p-4 bg-slate-950/80 border border-emerald-500/30 rounded-2xl shadow-glow-brand flex flex-col items-center justify-center shrink-0">
            <DrDoomOrbLogo size={88} showText={true} />
            <span className="text-[10px] font-bold text-emerald-400/80 mt-1">Official App Emblem</span>
          </div>
        </div>

        {/* Accordion Sections List */}
        <div className="space-y-4">
          {filteredSections.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl">No matching manual sections found. Try a different search query.</div>
          ) : (
            filteredSections.map((sec) => {
              const Icon = sec.icon;
              const isOpen = openSectionId === sec.id;

              return (
                <div key={sec.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden transition-all shadow-sm">
                  {/* Accordion Header */}
                  <div onClick={() => toggleSection(sec.id)} className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-3.5">
                      <div className={`p-2.5 rounded-xl border ${sec.bg} ${sec.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white tracking-tight">{sec.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{sec.summary}</p>
                      </div>
                    </div>

                    <button className="p-1 text-slate-400 hover:text-white rounded-lg">{isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</button>
                  </div>

                  {/* Accordion Body */}
                  {isOpen && (
                    <div className="p-5 border-t border-slate-800/60 bg-slate-950/40 space-y-4">
                      <div className="space-y-3">
                        {sec.steps.map((st, idx) => (
                          <div key={idx} className="p-3.5 bg-slate-900/80 border border-slate-800/80 rounded-xl space-y-1">
                            <h4 className="text-xs font-bold text-brand-300 flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                              {st.title}
                            </h4>
                            <p className="text-xs text-slate-300 leading-relaxed pl-5.5">{st.desc}</p>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => {
                            if (sec.id === 'android-app-guide') {
                              window.location.href = ANDROID_RELEASE.downloadUrl;
                            } else {
                              navigate(sec.targetRoute);
                            }
                          }}
                          className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-glow-brand transition-all flex items-center gap-2 group"
                        >
                          <span>{sec.actionLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
};
