import React, { useState } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { 
  BookOpen, 
  Search, 
  UserPlus, 
  Edit3, 
  MessageSquare, 
  ShieldCheck, 
  Smartphone, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  Users, 
  Radio, 
  Lock, 
  CheckCircle2, 
  Heart, 
  Bookmark, 
  Phone, 
  Video 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
      title: '1. Getting Started (Account & Profile)',
      category: 'Account',
      icon: UserPlus,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      summary: 'Learn how to create an account, log in securely, and customize your user profile.',
      targetRoute: '/settings',
      actionLabel: 'Edit Profile Settings',
      steps: [
        {
          title: 'Step 1: Create an Account',
          desc: 'Click "Sign up" on the login screen, enter your desired username, email, and password, then submit to register.'
        },
        {
          title: 'Step 2: Log In to Your Session',
          desc: 'Use your registered username or email and password. JWT access and refresh tokens will be stored securely.'
        },
        {
          title: 'Step 3: Customize Profile & Avatar',
          desc: 'Navigate to Profile or Settings -> Account Profile to upload your profile avatar image, add a bio, and specify location.'
        }
      ]
    },
    {
      id: 'posts-and-feed',
      title: '2. Posts & Feed Management',
      category: 'Feed',
      icon: Edit3,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      summary: 'How to create posts, upload media, like, comment, and bookmark posts.',
      targetRoute: '/explore',
      actionLabel: 'Explore Feed Now',
      steps: [
        {
          title: 'Step 1: Create a Post',
          desc: 'Click "Create Post" in the sidebar or mobile action bar. Type text (up to 2,200 characters) and attach images or video.'
        },
        {
          title: 'Step 2: Like & Comment',
          desc: 'Tap the Heart icon on any post card to like it. Click the Comment icon to participate in discussions.'
        },
        {
          title: 'Step 3: Bookmark Content',
          desc: 'Click the Bookmark icon on posts to save them to your private collection under Settings -> Bookmarks.'
        },
        {
          title: 'Step 4: Switch Global vs Following Feed',
          desc: 'Use top tabs on Home Feed to switch between global posts and updates strictly from users you follow.'
        }
      ]
    },
    {
      id: 'direct-messages',
      title: '3. Direct Messages & WebRTC Calls',
      category: 'Messaging',
      icon: MessageSquare,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      summary: 'Send 1-on-1 end-to-end encrypted direct messages and start phone or video calls.',
      targetRoute: '/messages',
      actionLabel: 'Open Direct Messages',
      steps: [
        {
          title: 'Step 1: Select a Contact',
          desc: 'Navigate to Messages and pick a contact from the sidebar list.'
        },
        {
          title: 'Step 2: End-to-End Encryption (E2EE)',
          desc: 'Direct messages are encrypted in your browser using 256-bit AES-GCM prior to transmission. A green lock icon verifies security.'
        },
        {
          title: 'Step 3: Real-Time Typing Indicators',
          desc: 'When typing in the input field, the server broadcasts debounced typing indicators ("User is typing...").'
        },
        {
          title: 'Step 4: Initiate WebRTC Voice / Video Calls',
          desc: 'Click the "Phone Call" or "Video Call" buttons in the chat header to initiate peer-to-peer WebRTC calls.'
        }
      ]
    },
    {
      id: 'groups-and-broadcasts',
      title: '4. Group Chats & Message Broadcasts',
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
          title: 'Step 2: Chat in Group Room',
          desc: 'Group messages are delivered instantly via Socket.IO to all active group members.'
        },
        {
          title: 'Step 3: Dispatch Broadcast Announcements',
          desc: 'Click "Broadcast", select recipient contacts, write your message, and click "Dispatch".'
        },
        {
          title: 'Step 4: Privacy Guarantee',
          desc: 'Broadcasts arrive as 1-on-1 direct messages for each recipient without exposing recipient lists.'
        }
      ]
    },
    {
      id: 'security-and-privacy',
      title: '5. Security, Privacy & E2EE Architecture',
      category: 'Security',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      summary: 'Academic viva explanation of client-side cryptography, JWT tokens, and Oracle DB storage.',
      targetRoute: '/settings',
      actionLabel: 'Security Settings',
      steps: [
        {
          title: 'Client-Side Web Crypto API',
          desc: 'Nexa uses native `window.crypto.subtle` or Android `javax.crypto.Cipher` (AES-256-GCM + PBKDF2 with 100,000 iterations).'
        },
        {
          title: 'Zero Plaintext Storage',
          desc: 'The database server only stores ciphertext formatted as `E2EE::<iv>::<cipher>`. Administrators cannot inspect message content.'
        },
        {
          title: 'Authentication Security',
          desc: 'JWT access tokens expire after 15 minutes, supported by HTTP-only refresh tokens and EncryptedSharedPreferences on Android.'
        }
      ]
    },
    {
      id: 'android-app-guide',
      title: '6. Nexa Android Mobile Application',
      category: 'Mobile',
      icon: Smartphone,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      summary: 'How to install and use the native Android (.apk) mobile application.',
      targetRoute: '/help',
      actionLabel: 'Download Android APK',
      steps: [
        {
          title: 'Step 1: Download & Install APK',
          desc: 'Click the "Android App (Download APK)" link in the sidebar or download `nexa-social-app.apk`.'
        },
        {
          title: 'Step 2: Native Bottom Navigation',
          desc: 'Use bottom navigation tabs for Home, Explore, Messages, Reels, and Profile.'
        },
        {
          title: 'Step 3: Background Push Notifications',
          desc: 'System notifications alert you when new messages arrive while the app is in the background.'
        },
        {
          title: 'Step 4: Offline Detection & Auto-Reconnect',
          desc: 'An integrated offline banner alerts you when network drops and automatically reloads content when connected.'
        }
      ]
    }
  ];

  const filteredSections = sections.filter((sec) =>
    sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sec.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sec.steps.some((st) => st.title.toLowerCase().includes(searchQuery.toLowerCase()) || st.desc.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
        {/* Header Hero */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-500/20 border border-brand-500/30 rounded-full text-brand-300 text-xs font-semibold">
            <BookOpen className="w-4 h-4" /> Nexa User Manual & Project Viva Guide
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Nexa Project User Manual
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
            Learn how to use Nexa step by step. Explore guides on account setup, post publishing, 256-bit AES-GCM End-to-End Encrypted messaging, group chats, broadcasts, and the Android mobile app.
          </p>

          {/* Search Box */}
          <div className="relative max-w-md pt-2">
            <Search className="w-4 h-4 absolute left-3.5 top-5.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user manual topics..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none shadow-inner"
            />
          </div>
        </div>

        {/* Accordion Sections List */}
        <div className="space-y-4">
          {filteredSections.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400 bg-slate-900/40 border border-slate-800 rounded-2xl">
              No matching manual sections found. Try a different search query.
            </div>
          ) : (
            filteredSections.map((sec) => {
              const Icon = sec.icon;
              const isOpen = openSectionId === sec.id;

              return (
                <div
                  key={sec.id}
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden transition-all shadow-sm"
                >
                  {/* Accordion Header */}
                  <div
                    onClick={() => toggleSection(sec.id)}
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`p-2.5 rounded-xl border ${sec.bg} ${sec.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white tracking-tight">{sec.title}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{sec.summary}</p>
                      </div>
                    </div>

                    <button className="p-1 text-slate-400 hover:text-white rounded-lg">
                      {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
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
                              window.location.href = '/nexa-social-app.apk';
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
