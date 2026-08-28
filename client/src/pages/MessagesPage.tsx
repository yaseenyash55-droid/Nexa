import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialApi } from '../api/social.api.js';
import { usersApi } from '../api/users.api.js';
import { groupsApi, Group, GroupMessage } from '../api/groups.api.js';
import { broadcastsApi, Broadcast } from '../api/broadcasts.api.js';
import { Message, User } from '../types/index.js';
import { Avatar } from '../components/ui/Avatar.js';
import { Send, MessageSquare, Search, CheckCheck, Check, Phone, Video, ShieldCheck, Users, Plus, Radio, FileText, Download, Sparkles, Smile, Image as ImageIcon, Settings } from 'lucide-react';
import { CallModal } from '../components/chat/CallModal.js';
import { CreateGroupModal } from '../components/chat/CreateGroupModal.js';
import { CreateBroadcastModal } from '../components/chat/CreateBroadcastModal.js';
import { GroupInfoModal } from '../components/chat/GroupInfoModal.js';
import { useAuth } from '../contexts/AuthContext.js';
import { formatDistanceToNow } from 'date-fns';
import { io, Socket } from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext.js';
import { API_BASE_URL, getAccessToken } from '../api/client.js';
import { decryptMessage, DecryptedMessageResult } from '../utils/e2ee.js';
import { webFcmService } from '../services/fcm.service.js';
import { EmojiPickerPopover } from '../components/ui/EmojiPickerPopover.js';
import { GifPickerModal } from '../components/ui/GifPickerModal.js';

import { mediaCache } from '../utils/mediaCache.js';

const CachedMedia: React.FC<{
  url: string;
  type: 'image' | 'video' | 'gif';
  className?: string;
  onClick?: () => void;
  controls?: boolean;
}> = ({ url, type, className, onClick, controls }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    async function load() {
      try {
        setLoading(true);
        const cached = await mediaCache.getMedia(url);
        if (cached && active) {
          setSrc(cached.objectUrl);
          localUrl = cached.objectUrl;
          setLoading(false);
          return;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Fetch failed');
        const blob = await res.blob();
        if (active) {
          const objUrl = URL.createObjectURL(blob);
          setSrc(objUrl);
          localUrl = objUrl;
          setLoading(false);
        }
        await mediaCache.saveMedia(url, blob, res.headers.get('content-type') || '');
      } catch (err) {
        console.error('Failed to load cached media:', err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [url]);

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl min-h-[160px] animate-pulse`}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] text-slate-500 font-semibold">Loading media...</span>
        </div>
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl min-h-[160px]`}>
        <span className="text-xs text-rose-400">Failed to load media</span>
      </div>
    );
  }

  if (type === 'image' || type === 'gif') {
    return (
      <img
        src={src}
        alt="Media"
        className={className}
        onClick={onClick}
        loading="lazy"
      />
    );
  }

  if (type === 'video') {
    return (
      <video
        src={src}
        controls={controls}
        playsInline
        className={className}
        preload="metadata"
      />
    );
  }

  return null;
};

const MessageContent: React.FC<{ content: string; isSelf?: boolean }> = ({ content }) => {
  // 1. Check if content has photo URL (e.g. 📷 [Photo] https://... or direct image URL)
  const photoMatch = content.match(/(?:📷\s*\[Photo\]\s*|(?:^|\s))(https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif)(?:\?\S*)?|https?:\/\/\S*supabase\.co\S*|https?:\/\/\S*\/uploads\/\S+)/i);
  // 2. Check if content has video URL (e.g. 🎥 [Video] https://... or direct video URL)
  const videoMatch = content.match(/(?:🎥\s*\[Video\]\s*|(?:^|\s))(https?:\/\/\S+\.(?:mp4|webm|mov|3gp)(?:\?\S*)?)/i);
  // 3. Check if content has file URL (e.g. 📁 [File] https://... or general file URL)
  const fileMatch = content.match(/(?:📁\s*\[File\]\s*)(https?:\/\/\S+)/i);
  // 4. Check for GIF badge or animated GIF URL
  const gifMatch = content.match(/^\[GIF:\s*(.+?)\]$/i);
  const gifUrl = gifMatch && (gifMatch[1].startsWith('http://') || gifMatch[1].startsWith('https://'))
    ? gifMatch[1]
    : !gifMatch && /(?:https?:\/\/\S+\.gif(?:\?\S*)?|https?:\/\/media\.giphy\.com\S*|https?:\/\/media\.tenor\.com\S*)/i.test(content)
    ? content.match(/(https?:\/\/\S+(?:\.gif(?:\?\S*)?|giphy\.com\S*|tenor\.com\S*))/i)?.[1]
    : null;

  if (gifUrl) {
    return (
      <div className="space-y-1">
        <div className="rounded-xl overflow-hidden max-w-[280px] border border-white/15 shadow-lg bg-black/40 group">
          <CachedMedia
            url={gifUrl}
            type="gif"
            className="w-full max-h-64 object-cover cursor-pointer hover:scale-[1.02] transition duration-200"
            onClick={() => window.open(gifUrl, '_blank')}
          />
          <div className="px-2 py-0.5 bg-black/70 flex items-center justify-between text-[10px] font-bold text-slate-300">
            <span className="flex items-center gap-1 text-emerald-400">
              <Sparkles className="w-3 h-3" /> GIF
            </span>
            <span className="text-[9px] text-slate-400 font-normal">Click to expand</span>
          </div>
        </div>
      </div>
    );
  }

  if (photoMatch) {
    const url = photoMatch[1];
    const cleanText = content.replace(photoMatch[0], '').trim();
    return (
      <div className="space-y-1.5">
        <div className="rounded-xl overflow-hidden max-w-[280px] border border-white/10 shadow-md bg-black/20">
          <CachedMedia
            url={url}
            type="image"
            className="w-full max-h-64 object-cover cursor-pointer hover:scale-[1.02] transition duration-200"
            onClick={() => window.open(url, '_blank')}
          />
        </div>
        {cleanText && <p className="leading-relaxed whitespace-pre-line text-xs">{cleanText}</p>}
      </div>
    );
  }

  if (videoMatch) {
    const url = videoMatch[1];
    const cleanText = content.replace(videoMatch[0], '').trim();
    return (
      <div className="space-y-1.5">
        <div className="rounded-xl overflow-hidden max-w-[300px] border border-white/10 shadow-md bg-black/40">
          <CachedMedia
            url={url}
            type="video"
            controls
            className="w-full max-h-64 rounded-xl"
          />
        </div>
        {cleanText && <p className="leading-relaxed whitespace-pre-line text-xs">{cleanText}</p>}
      </div>
    );
  }

  if (fileMatch) {
    const url = fileMatch[1];
    const fileName = url.split('/').pop()?.split('?')[0] || 'Attachment File';
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 p-2.5 bg-slate-900/70 hover:bg-slate-900 rounded-xl border border-slate-700/50 transition max-w-[280px] group"
      >
        <div className="p-2 bg-brand-500/20 rounded-lg text-brand-300">
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">{decodeURIComponent(fileName)}</p>
          <p className="text-[10px] text-brand-300 flex items-center gap-1">Click to download</p>
        </div>
        <Download className="w-4 h-4 text-slate-400 group-hover:text-white transition" />
      </a>
    );
  }

  if (gifMatch) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 bg-brand-500/20 text-brand-200 rounded-xl border border-brand-500/30 text-xs font-bold shadow-sm">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        <span>{gifMatch[1]}</span>
      </div>
    );
  }

  if (content.startsWith('🤖 **NEXA AI**:') || content.startsWith('🤖 NEXA AI:')) {
    const aiText = content.replace(/^🤖\s*\*\*NEXA AI\*\*:\s*/i, '').replace(/^🤖\s*NEXA AI:\s*/i, '').trim();
    return (
      <div className="space-y-1.5 p-1 rounded-xl bg-gradient-to-tr from-brand-950/40 via-slate-900/60 to-aurora-cyan/10 border border-brand-500/30 shadow-glow-brand">
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-bold text-aurora-cyan uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-aurora-cyan animate-pulse" />
          <span>NEXA AI Assistant</span>
        </div>
        <p className="leading-relaxed whitespace-pre-line text-xs text-slate-100 font-sans px-1 pb-1">
          {aiText}
        </p>
      </div>
    );
  }

  return <p className="leading-relaxed whitespace-pre-line">{content}</p>;
};

export const MessagesPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { currentChatTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const requestedUserId = Number.parseInt(searchParams.get('userId') || '', 10);

  // Tab & Selection State
  const [chatType, setChatType] = useState<'direct' | 'groups' | 'broadcasts'>('direct');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);

  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isCreateBroadcastOpen, setIsCreateBroadcastOpen] = useState(false);

  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);

  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [callModalState, setCallModalState] = useState<{
    isOpen: boolean;
    type: 'audio' | 'video';
    direction: 'outgoing' | 'incoming';
    callId?: string;
    targetUser?: User;
  }>({ isOpen: false, type: 'audio', direction: 'outgoing' });

  // Sync draft from localStorage on active chat change
  useEffect(() => {
    try {
      if (chatType === 'direct' && selectedUser) {
        const draft = localStorage.getItem(`nexa_chat_draft_user_${selectedUser.userId}`) || '';
        setMessageInput(draft);
      } else if (chatType === 'groups' && selectedGroup) {
        const draft = localStorage.getItem(`nexa_chat_draft_group_${selectedGroup.groupId}`) || '';
        setMessageInput(draft);
      } else {
        setMessageInput('');
      }
    } catch (_e) {}
  }, [chatType, selectedUser?.userId, selectedGroup?.groupId]);

  // Real-time Typing Indicator State
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsername, setTypingUsername] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const [realtimeSocket, setRealtimeSocket] = useState<Socket | null>(null);
  const callModalOpenRef = useRef(false);
  const selectedUserRef = useRef<User | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isEmittingTypingRef = useRef(false);
  const autoClearTypingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // End-to-End Encryption Decrypted Content Map
  const [decryptedMap, setDecryptedMap] = useState<Record<number, DecryptedMessageResult>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const readRequestsRef = useRef(new Set<number>());

  useEffect(() => {
    callModalOpenRef.current = callModalState.isOpen;
  }, [callModalState.isOpen]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Fetch contacts & conversations (Direct Messages)
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => socialApi.getConversations()
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: () => usersApi.getSuggestions()
  });

  const { data: requestedUser } = useQuery({
    queryKey: ['message-target-user', requestedUserId],
    queryFn: () => usersApi.getById(requestedUserId),
    enabled:
      Number.isInteger(requestedUserId) &&
      requestedUserId > 0 &&
      requestedUserId !== currentUser?.userId
  });

  useEffect(() => {
    if (!requestedUser || requestedUser.userId === currentUser?.userId) return;

    setChatType('direct');
    setSelectedGroup(null);
    setSelectedBroadcast(null);
    setSelectedUser(requestedUser);
  }, [currentUser?.userId, requestedUser]);

  // Fetch user groups (Group Chats)
  const { data: groups = [] } = useQuery({
    queryKey: ['user-groups'],
    queryFn: () => groupsApi.getUserGroups()
  });

  // Fetch user broadcasts (Broadcast History)
  const { data: broadcasts = [] } = useQuery({
    queryKey: ['user-broadcasts'],
    queryFn: () => broadcastsApi.getUserBroadcasts()
  });

  // Fetch active DM messages
  const { data: messages = [], isLoading: isMessagesLoading } = useQuery({
    queryKey: ['messages', selectedUser?.userId],
    queryFn: () => (selectedUser ? socialApi.getMessagesWithUser(selectedUser.userId) : Promise.resolve([])),
    enabled: !!selectedUser?.userId && chatType === 'direct'
  });

  // Fetch active Group messages
  const { data: groupMessages = [], isLoading: isGroupMessagesLoading } = useQuery({
    queryKey: ['group-messages', selectedGroup?.groupId],
    queryFn: () => (selectedGroup ? groupsApi.getGroupMessages(selectedGroup.groupId) : Promise.resolve([])),
    enabled: !!selectedGroup?.groupId && chatType === 'groups'
  });

  // Fetch active Group members for permissions
  const { data: selectedGroupMembers = [] } = useQuery({
    queryKey: ['group-members', selectedGroup?.groupId],
    queryFn: () => (selectedGroup ? groupsApi.getGroupMembers(selectedGroup.groupId) : Promise.resolve([])),
    enabled: !!selectedGroup?.groupId && chatType === 'groups'
  });

  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const isCurrentGroupAdmin = selectedGroup
    ? selectedGroup.createdBy === currentUser?.userId ||
      selectedGroupMembers.some((m) => m.userId === currentUser?.userId && m.role === 'ADMIN')
    : false;
  const isPostingDisabled = Boolean(selectedGroup?.onlyAdminsCanPost && !isCurrentGroupAdmin);

  // Send Direct Message (TLS-Protected)
  const sendDirectMessageMutation = useMutation<Message, Error, string | void>({
    mutationFn: async (overrideContent) => {
      const textToSend = (typeof overrideContent === 'string' ? overrideContent : messageInput).trim();
      if (!currentUser || !selectedUser || !textToSend) {
        throw new Error('Invalid send message state');
      }
      return socialApi.sendMessage(selectedUser.userId, textToSend);
    },
    onSuccess: (message) => {
      setMessageInput('');
      if (selectedUser) {
        try {
          localStorage.removeItem(`nexa_chat_draft_user_${selectedUser.userId}`);
        } catch (_e) {}
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData<Message[]>(['messages', selectedUser?.userId], (current = []) =>
        current.some((item) => item.messageId === message.messageId) ? current : [...current, message]
      );
    }
  });

  // Send Group Message
  const sendGroupMessageMutation = useMutation<GroupMessage, Error, string | void>({
    mutationFn: async (overrideContent) => {
      const textToSend = (typeof overrideContent === 'string' ? overrideContent : messageInput).trim();
      if (!selectedGroup || !textToSend) {
        throw new Error('Invalid group message state');
      }
      return groupsApi.sendGroupMessage(selectedGroup.groupId, textToSend);
    },
    onSuccess: (msg) => {
      setMessageInput('');
      if (selectedGroup) {
        try {
          localStorage.removeItem(`nexa_chat_draft_group_${selectedGroup.groupId}`);
        } catch (_e) {}
      }
      queryClient.setQueryData<GroupMessage[]>(['group-messages', selectedGroup?.groupId], (current = []) =>
        current.some((item) => item.messageId === msg.messageId) ? current : [...current, msg]
      );
    }
  });

  // Decrypt direct messages asynchronously
  useEffect(() => {
    if (!currentUser || !selectedUser || chatType !== 'direct') return;
    let isMounted = true;

    const processDecryption = async () => {
      const newMap: Record<number, DecryptedMessageResult> = {};
      for (const msg of messages) {
        const decrypted = await decryptMessage(currentUser.userId, selectedUser.userId, msg.content);
        newMap[msg.messageId] = decrypted;
      }
      if (isMounted) {
        setDecryptedMap(newMap);
      }
    };

    processDecryption();
    return () => {
      isMounted = false;
    };
  }, [messages, currentUser, selectedUser, chatType]);

  // Reset typing state when switching targets
  useEffect(() => {
    setIsTyping(false);
    setTypingUsername('');
    if (autoClearTypingTimerRef.current) {
      clearTimeout(autoClearTypingTimerRef.current);
    }
  }, [selectedUser, selectedGroup, chatType]);

  useEffect(() => {
    if (!currentUser) return;
    const token = getAccessToken();
    if (!token) return;

    const socketHost = API_BASE_URL.replace(/\/api$/, '');
    const socket = io(socketHost, {
      auth: { token: token.startsWith('Bearer ') ? token : `Bearer ${token}` },
      withCredentials: true,
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;
    setRealtimeSocket(socket);

    socket.on('message:created', (message: Message) => {
      const otherUserId = message.senderId === currentUser.userId ? message.receiverId : message.senderId;
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueryData<Message[]>(['messages', otherUserId], (current = []) =>
        current.some((item) => item.messageId === message.messageId) ? current : [...current, message]
      );
    });

    socket.on('group:message:created', (msg: GroupMessage) => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      queryClient.setQueryData<GroupMessage[]>(['group-messages', msg.groupId], (current = []) =>
        current.some((item) => item.messageId === msg.messageId) ? current : [...current, msg]
      );
    });

    socket.on('group:settings:updated', (updatedGroup: Group) => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      if (selectedGroup?.groupId === updatedGroup.groupId) {
        setSelectedGroup(updatedGroup);
      }
    });

    socket.on('group:deleted', ({ groupId }: { groupId: number }) => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      if (selectedGroup?.groupId === groupId) {
        setSelectedGroup(null);
      }
    });

    socket.on('group:removed', ({ groupId }: { groupId: number }) => {
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
      if (selectedGroup?.groupId === groupId) {
        setSelectedGroup(null);
      }
    });

    socket.on('group:members:updated', ({ groupId }: { groupId: number }) => {
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['user-groups'] });
    });

    socket.on('message:read', ({ messageId }: { messageId: number }) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.setQueriesData<Message[]>({ queryKey: ['messages'] }, (current = []) =>
        current.map((message) => message.messageId === messageId ? { ...message, isRead: true } : message)
      );
    });

    socket.on('typing:start', ({ userId, username }: { userId: number; username: string }) => {
      const activeUser = selectedUserRef.current;
      if (activeUser && userId === activeUser.userId) {
        setIsTyping(true);
        setTypingUsername(username || activeUser.displayName);

        if (autoClearTypingTimerRef.current) {
          clearTimeout(autoClearTypingTimerRef.current);
        }
        autoClearTypingTimerRef.current = setTimeout(() => {
          setIsTyping(false);
        }, 3500);
      }
    });

    socket.on('typing:stop', ({ userId }: { userId: number }) => {
      if (selectedUserRef.current && userId === selectedUserRef.current.userId) {
        setIsTyping(false);
        if (autoClearTypingTimerRef.current) {
          clearTimeout(autoClearTypingTimerRef.current);
        }
      }
    });

    socket.on('call:invite', async ({
      callId,
      callerId,
      callerUsername,
      callType
    }: {
      callId: string;
      callerId: number;
      callerUsername: string;
      callType: 'audio' | 'video';
    }) => {
      if (callModalOpenRef.current) {
        socket.emit('call:reject', { callId, reason: 'busy' });
        return;
      }
      try {
        const caller = await usersApi.getById(callerId);
        setCallModalState({
          isOpen: true,
          type: callType,
          direction: 'incoming',
          callId,
          targetUser: caller
        });
      } catch {
        socket.emit('call:reject', { callId, reason: 'unavailable' });
        console.warn(`Unable to resolve incoming caller ${callerUsername}`);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setRealtimeSocket(null);
    };
  }, [currentUser, queryClient]);

  // Handle Web Push Call Notification Actions & Deep Links
  useEffect(() => {
    const pushCallId = searchParams.get('callId');
    const pushTargetId = Number.parseInt(searchParams.get('targetId') || searchParams.get('userId') || '', 10);
    const pushCallType = (searchParams.get('callType') === 'video' ? 'video' : 'audio') as 'video' | 'audio';
    const pushAction = searchParams.get('action');

    if (pushCallId && pushTargetId > 0 && pushAction === 'accept') {
      void usersApi.getById(pushTargetId).then((target) => {
        setCallModalState({
          isOpen: true,
          type: pushCallType,
          direction: 'incoming',
          callId: pushCallId,
          targetUser: target
        });
      }).catch(() => {
        console.warn('Unable to resolve push caller target user');
      });
    }

    const unsubscribe = webFcmService.onCallAction(async (event) => {
      if (event.action === 'accept' && event.callId && event.callerId) {
        const callerIdNum = Number(event.callerId);
        try {
          const target = await usersApi.getById(callerIdNum);
          setCallModalState({
            isOpen: true,
            type: event.callType === 'video' ? 'video' : 'audio',
            direction: 'incoming',
            callId: event.callId,
            targetUser: target
          });
        } catch {
          console.warn('Unable to load target user for call action');
        }
      } else if (event.action === 'decline' && event.callId) {
        socketRef.current?.emit('call:reject', { callId: event.callId, reason: 'declined' });
        setCallModalState((prev) => (prev.callId === event.callId ? { ...prev, isOpen: false } : prev));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [searchParams]);

  useEffect(() => {
    if (!currentUser || !selectedUser || chatType !== 'direct') return;
    messages
      .filter((message) => message.receiverId === currentUser.userId && !message.isRead && !readRequestsRef.current.has(message.messageId))
      .forEach((message) => {
        readRequestsRef.current.add(message.messageId);
        void socialApi.markMessageRead(message.messageId).then((result) => {
          if (result.read) {
            queryClient.setQueryData<Message[]>(['messages', selectedUser.userId], (current = []) =>
              current.map((item) => item.messageId === message.messageId ? { ...item, isRead: true } : item)
            );
          }
        }).catch(() => readRequestsRef.current.delete(message.messageId));
      });
  }, [currentUser, messages, queryClient, selectedUser, chatType]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, groupMessages, isTyping, decryptedMap]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessageInput(value);

    try {
      if (chatType === 'direct' && selectedUser) {
        if (value) localStorage.setItem(`nexa_chat_draft_user_${selectedUser.userId}`, value);
        else localStorage.removeItem(`nexa_chat_draft_user_${selectedUser.userId}`);
      } else if (chatType === 'groups' && selectedGroup) {
        if (value) localStorage.setItem(`nexa_chat_draft_group_${selectedGroup.groupId}`, value);
        else localStorage.removeItem(`nexa_chat_draft_group_${selectedGroup.groupId}`);
      }
    } catch (_e) {}

    if (!selectedUser || !socketRef.current || chatType !== 'direct') return;

    if (value.trim().length > 0) {
      if (!isEmittingTypingRef.current) {
        isEmittingTypingRef.current = true;
        socketRef.current.emit('typing:start', { receiverId: selectedUser.userId });
      }

      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }

      typingTimerRef.current = setTimeout(() => {
        if (socketRef.current && selectedUser) {
          socketRef.current.emit('typing:stop', { receiverId: selectedUser.userId });
        }
        isEmittingTypingRef.current = false;
      }, 2000);
    } else {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      if (isEmittingTypingRef.current) {
        socketRef.current.emit('typing:stop', { receiverId: selectedUser.userId });
        isEmittingTypingRef.current = false;
      }
    }
  };

  const handleSendMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    if (chatType === 'direct' && selectedUser) {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      if (socketRef.current && isEmittingTypingRef.current) {
        socketRef.current.emit('typing:stop', { receiverId: selectedUser.userId });
        isEmittingTypingRef.current = false;
      }
      sendDirectMessageMutation.mutate();
    } else if (chatType === 'groups' && selectedGroup) {
      sendGroupMessageMutation.mutate();
    }
  };

  const displayDirectItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (conversations.length > 0) {
      const filtered = conversations.filter(c =>
        c.displayName.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
      );
      if (filtered.length > 0 || !q) {
        return { type: 'conversations' as const, items: filtered };
      }
    }
    const filteredSug = suggestions.filter(u =>
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
    return { type: 'suggestions' as const, items: filteredSug };
  }, [conversations, suggestions, searchQuery]);

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredBroadcasts = broadcasts.filter(b =>
    (b.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isSelectionActive = chatType === 'direct' ? !!selectedUser : chatType === 'groups' ? !!selectedGroup : !!selectedBroadcast;

  return (
    <AppShell>
      <div className="h-[calc(100vh-4rem)] md:h-screen flex border-r border-slate-800/80 overflow-hidden">
        {/* Left Sidebar */}
        <div className={`w-full md:w-80 border-r border-slate-800/80 flex flex-col bg-background-card/20 ${
          isSelectionActive ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header & Action Buttons */}
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand-400" /> Messages
              </h1>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsCreateBroadcastOpen(true)}
                  title="New Broadcast List"
                  className="p-1.5 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white border border-cyan-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Radio className="w-3.5 h-3.5" /> Broadcast
                </button>
                <button
                  onClick={() => setIsCreateGroupOpen(true)}
                  title="New Group Chat"
                  className="p-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-glow-brand"
                >
                  <Plus className="w-3.5 h-3.5" /> Group
                </button>
              </div>
            </div>

            {/* Direct vs Groups vs Broadcasts Toggle Buttons */}
            <div className="grid grid-cols-3 p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <button
                onClick={() => {
                  setChatType('direct');
                  setSelectedGroup(null);
                  setSelectedBroadcast(null);
                }}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${
                  chatType === 'direct'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3 h-3" /> Direct
              </button>

              <button
                onClick={() => {
                  setChatType('groups');
                  setSelectedUser(null);
                  setSelectedBroadcast(null);
                }}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${
                  chatType === 'groups'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3 h-3" /> Groups ({groups.length})
              </button>

              <button
                onClick={() => {
                  setChatType('broadcasts');
                  setSelectedUser(null);
                  setSelectedGroup(null);
                }}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 ${
                  chatType === 'broadcasts'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-3 h-3" /> Broadcasts
              </button>
            </div>
            
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  chatType === 'direct'
                    ? "Search contacts or messages..."
                    : chatType === 'groups'
                    ? "Search groups..."
                    : "Search broadcasts..."
                }
                className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
            {chatType === 'direct' && (
              <a
                href="/ai"
                className="flex items-center gap-3 p-3 bg-gradient-to-r from-brand-900/30 via-indigo-900/20 to-aurora-cyan/10 hover:from-brand-900/50 hover:to-aurora-cyan/20 border-b border-brand-500/20 transition-all group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 via-indigo-500 to-aurora-cyan p-0.5 flex-shrink-0 shadow-glow-brand ring-2 ring-brand-500/30">
                  <div className="w-full h-full bg-background-card/90 rounded-full flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-aurora-cyan animate-pulse-slow" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100 flex items-center gap-1">
                      ✨ NEXA AI
                      <span className="px-1.5 py-0.2 bg-brand-500/20 text-brand-300 text-[9px] font-semibold rounded-full border border-brand-500/30">Assistant</span>
                    </span>
                    <span className="text-[10px] text-aurora-cyan font-medium">Online</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">Ask questions, generate captions, summarize & translate</p>
                </div>
              </a>
            )}

            {chatType === 'direct' ? (
              displayDirectItems.items.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No direct conversations found</div>
              ) : (
                displayDirectItems.items.map((item: any) => {
                  if (displayDirectItems.type === 'conversations') {
                    const c = item;
                    const isSelected = selectedUser?.userId === c.otherUserId;
                    const targetUser: User = {
                      userId: c.otherUserId,
                      username: c.username,
                      displayName: c.displayName,
                      profileImageUrl: c.profileImageUrl,
                      email: '',
                      createdAt: '',
                      updatedAt: ''
                    };
                    const lastMsg = c.lastMessage?.trim() || '';
                    const formattedMsg = lastMsg.startsWith('[GIF:') || lastMsg.endsWith('.gif')
                      ? '✨ GIF animation'
                      : lastMsg.includes('[Photo]') || lastMsg.includes('📷')
                      ? '📷 Photo attachment'
                      : lastMsg.includes('[File]') || lastMsg.includes('📁')
                      ? '📁 File attachment'
                      : lastMsg || 'Started conversation';

                    const formatTime = (iso: string | null) => {
                      if (!iso) return '';
                      try {
                        const d = new Date(iso);
                        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      } catch {
                        return '';
                      }
                    };

                    return (
                      <div
                        key={c.otherUserId}
                        onClick={() => setSelectedUser(targetUser)}
                        className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-brand-600/15 border-l-4 border-brand-500' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <Avatar src={c.profileImageUrl} name={c.displayName} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                              {c.displayName}
                              <span className="text-[11px] font-normal text-slate-400">@{c.username}</span>
                            </p>
                            {c.lastMessageAt && (
                              <span className="text-[10px] text-slate-500 shrink-0">{formatTime(c.lastMessageAt)}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <p className="text-[11px] text-slate-400 truncate flex-1">{formattedMsg}</p>
                            {c.unreadCount > 0 && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-brand-600 text-white rounded-full shrink-0">
                                {c.unreadCount > 99 ? '99+' : c.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    const u = item as User;
                    const isSelected = selectedUser?.userId === u.userId;
                    return (
                      <div
                        key={u.userId}
                        onClick={() => setSelectedUser(u)}
                        className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                          isSelected ? 'bg-brand-600/15 border-l-4 border-brand-500' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <Avatar src={u.profileImageUrl} name={u.displayName} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                              {u.displayName}
                              <span className="text-[11px] font-normal text-slate-400">@{u.username}</span>
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">Tap to start chatting</p>
                        </div>
                      </div>
                    );
                  }
                })
              )
            ) : chatType === 'groups' ? (
              filteredGroups.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                  <p>No group chats yet</p>
                  <button
                    onClick={() => setIsCreateGroupOpen(true)}
                    className="px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-xl"
                  >
                    Create Group
                  </button>
                </div>
              ) : (
                filteredGroups.map((g) => {
                  const isSelected = selectedGroup?.groupId === g.groupId;
                  return (
                    <div
                      key={g.groupId}
                      onClick={() => setSelectedGroup(g)}
                      className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-brand-600/15 border-l-4 border-brand-500' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-brand-600/30 border border-brand-500/30 flex items-center justify-center text-brand-300 font-bold">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="flex-1 truncate">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-white truncate">{g.name}</p>
                          <span className="text-[10px] text-slate-500">{g.membersCount || 1} members</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{g.lastMessage || g.description || 'Group conversation'}</p>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              filteredBroadcasts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                  <p>No broadcast history</p>
                  <button
                    onClick={() => setIsCreateBroadcastOpen(true)}
                    className="px-3 py-1.5 bg-cyan-600 text-white text-xs font-bold rounded-xl"
                  >
                    Send Broadcast
                  </button>
                </div>
              ) : (
                filteredBroadcasts.map((b) => {
                  const isSelected = selectedBroadcast?.broadcastId === b.broadcastId;
                  return (
                    <div
                      key={b.broadcastId}
                      onClick={() => setSelectedBroadcast(b)}
                      className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-cyan-600/15 border-l-4 border-cyan-500' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-cyan-600/30 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold">
                        <Radio className="w-5 h-5" />
                      </div>
                      <div className="flex-1 truncate">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-white truncate">{b.title || 'Broadcast List'}</p>
                          <span className="text-[10px] text-cyan-400">{b.recipientsCount} recipients</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{b.content}</p>
                      </div>
                    </div>
                  );
                })
              )
            )}
          </div>
        </div>

        {/* Right Active Chat Window */}
        <div className={`flex-1 flex flex-col ${currentChatTheme.background} ${
          !isSelectionActive ? 'hidden md:flex items-center justify-center' : 'flex'
        }`}>
          {!isSelectionActive ? (
            <div className="text-center space-y-3 p-6 max-w-sm">
              <div className="p-4 bg-slate-800/40 rounded-full w-16 h-16 mx-auto flex items-center justify-center text-brand-400">
                {chatType === 'direct' ? (
                  <ShieldCheck className="w-8 h-8 text-emerald-400" />
                ) : chatType === 'groups' ? (
                  <Users className="w-8 h-8 text-brand-400" />
                ) : (
                  <Radio className="w-8 h-8 text-cyan-400" />
                )}
              </div>
              <h2 className="text-lg font-bold text-white">
                {chatType === 'direct'
                  ? 'Direct Messages'
                  : chatType === 'groups'
                  ? 'Group Conversations'
                  : 'Message Broadcasts'}
              </h2>
              <p className="text-xs text-slate-400">
                {chatType === 'direct'
                  ? 'Select a contact from the left panel to start a secure conversation.'
                  : chatType === 'groups'
                  ? 'Select a group from the left panel or click "New Group" to chat with your team.'
                  : 'Send a message to multiple contacts at once. Each recipient gets a private direct message.'}
              </p>
            </div>
          ) : chatType === 'direct' && selectedUser ? (
            <>
              {/* Direct Chat Header */}
              <div className="p-3.5 border-b border-slate-800/80 bg-background-card/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="md:hidden text-xs text-brand-400 font-semibold pr-2"
                  >
                    ← Back
                  </button>
                  <Avatar src={selectedUser.profileImageUrl} name={selectedUser.displayName} size="sm" />
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      {selectedUser.displayName}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {isTyping ? (
                        <span className="text-brand-400 font-semibold flex items-center gap-1 animate-pulse">
                          is typing...
                        </span>
                      ) : (
                        'Encrypted in transit'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCallModalState({ isOpen: true, type: 'audio', direction: 'outgoing', targetUser: selectedUser })}
                    title="Start Phone Voice Call"
                    className="px-3 py-1.5 text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 rounded-xl transition-all border border-emerald-500/20 shadow-sm flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Phone className="w-4 h-4" />
                    <span className="hidden sm:inline">Phone Call</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCallModalState({ isOpen: true, type: 'video', direction: 'outgoing', targetUser: selectedUser })}
                    title="Start Video Call"
                    className="px-3 py-1.5 text-brand-300 hover:text-white bg-brand-600/20 hover:bg-brand-600 rounded-xl transition-all border border-brand-500/30 shadow-sm flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Video className="w-4 h-4" />
                    <span className="hidden sm:inline">Video Call</span>
                  </button>
                </div>
              </div>

              <div className="bg-brand-500/10 border-b border-brand-500/20 px-4 py-1.5 flex items-center justify-center gap-2 text-[11px] text-brand-300 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
                <span>Direct messages encrypted in-transit via TLS</span>
              </div>

              {/* Direct Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isMessagesLoading ? (
                  <div className="text-center text-xs text-slate-500 py-6">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 py-10">
                    No messages yet. Say hi to @{selectedUser.username}!
                  </div>
                ) : (
                  messages.map((m) => {
                    const isSelf = m.senderId === currentUser?.userId;
                    const decryptedInfo = decryptedMap[m.messageId] || { text: m.content, isEncrypted: m.content.startsWith('E2EE::') };

                    return (
                      <div
                        key={m.messageId}
                        className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] sm:max-w-md px-4 py-2.5 rounded-2xl text-xs space-y-1 ${
                            isSelf
                              ? `${currentChatTheme.senderBubble} rounded-br-none shadow-glow-brand`
                              : `${currentChatTheme.receiverBubble} rounded-bl-none`
                          }`}
                        >
                          <MessageContent content={decryptedInfo.text} isSelf={isSelf} />
                          <div className={`flex items-center justify-end gap-1.5 text-[9px] ${isSelf ? 'text-brand-200' : 'text-slate-400'}`}>
                            <span>{formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}</span>
                            {isSelf && (
                              <span title={m.isRead ? 'Read' : 'Sent'}>
                                {m.isRead
                                  ? <CheckCheck className="w-3 h-3 text-cyan-300" />
                                  : <Check className="w-3 h-3" />}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800/80 border border-slate-700/50 text-slate-300 rounded-2xl rounded-bl-none px-4 py-2.5 flex items-center gap-2 shadow-sm">
                      <span className="text-xs font-medium text-brand-300">
                        {typingUsername || selectedUser.displayName} is typing
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce"></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Form */}
              <form
                onSubmit={handleSendMessageSubmit}
                className="p-3 border-t border-slate-800/80 bg-background-card/60 flex items-center gap-2 relative"
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                    className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-xl transition"
                    title="Add Emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <EmojiPickerPopover
                    isOpen={isEmojiPickerOpen}
                    onClose={() => setIsEmojiPickerOpen(false)}
                    onSelectEmoji={(emoji) => {
                      setMessageInput((prev) => prev + emoji);
                    }}
                    position="top"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsGifModalOpen(true)}
                  className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 rounded-xl transition"
                  title="Search & Send GIF"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  value={messageInput}
                  onChange={handleInputChange}
                  placeholder={`Message @${selectedUser.username}...`}
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sendDirectMessageMutation.isPending}
                  className="p-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl shadow-glow-brand transition-all flex items-center justify-center"
                  title="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : chatType === 'groups' && selectedGroup ? (
            <>
              {/* Group Chat Header */}
              <div className="p-3.5 border-b border-slate-800/80 bg-background-card/40 flex items-center justify-between">
                <div
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => setIsGroupInfoOpen(true)}
                  title="View group info & settings"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGroup(null);
                    }}
                    className="md:hidden text-xs text-brand-400 font-semibold pr-2"
                  >
                    ← Back
                  </button>
                  <div className="w-9 h-9 rounded-full bg-brand-600/30 border border-brand-500/30 flex items-center justify-center text-brand-300 font-bold group-hover:scale-105 transition">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 group-hover:text-brand-300 transition">
                      {selectedGroup.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {selectedGroupMembers.length || selectedGroup.membersCount || 1} members {selectedGroup.description ? `• ${selectedGroup.description}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsGroupInfoOpen(true)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition"
                  title="Group Info & Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>

              {/* Announcement Mode Banner */}
              {selectedGroup.onlyAdminsCanPost && (
                <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-300 flex items-center justify-between">
                  <span>📢 Announcement Mode: Only admins can send messages.</span>
                  {isCurrentGroupAdmin && <span className="font-bold text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded">You are Admin</span>}
                </div>
              )}

              {/* Group Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isGroupMessagesLoading ? (
                  <div className="text-center text-xs text-slate-500 py-6">Loading group messages...</div>
                ) : groupMessages.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 py-10">
                    No messages in this group yet. Send a message to start chatting!
                  </div>
                ) : (
                  groupMessages.map((m) => {
                    const isSelf = m.senderId === currentUser?.userId;
                    return (
                      <div
                        key={m.messageId}
                        className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] sm:max-w-md px-4 py-2.5 rounded-2xl text-xs space-y-1 ${
                            isSelf
                              ? `${currentChatTheme.senderBubble} rounded-br-none shadow-glow-brand`
                              : `${currentChatTheme.receiverBubble} rounded-bl-none`
                          }`}
                        >
                          {!isSelf && (
                            <p className="text-[10px] font-bold text-brand-300 mb-0.5">
                              {m.sender.displayName || m.sender.username}
                            </p>
                          )}
                          <MessageContent content={m.content} isSelf={isSelf} />
                          <div className={`flex items-center justify-end text-[9px] ${isSelf ? 'text-brand-200' : 'text-slate-400'}`}>
                            <span>{formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Group Chat Input Form */}
              {isPostingDisabled ? (
                <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 text-center text-xs text-slate-400 font-medium">
                  🔒 Only group admins can send messages in this group.
                </div>
              ) : (
                <form
                  onSubmit={handleSendMessageSubmit}
                  className="p-3 border-t border-slate-800/80 bg-background-card/60 flex items-center gap-2 relative"
                >
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                      className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800/60 rounded-xl transition"
                      title="Add Emoji"
                    >
                      <Smile className="w-5 h-5" />
                    </button>

                    <EmojiPickerPopover
                      isOpen={isEmojiPickerOpen}
                      onClose={() => setIsEmojiPickerOpen(false)}
                      onSelectEmoji={(emoji) => {
                        setMessageInput((prev) => prev + emoji);
                      }}
                      position="top"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsGifModalOpen(true)}
                    className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 rounded-xl transition"
                    title="Search & Send GIF"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={`Message #${selectedGroup.name}...`}
                    className="flex-1 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!messageInput.trim() || sendGroupMessageMutation.isPending}
                    className="p-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl shadow-glow-brand transition-all flex items-center justify-center"
                    title="Send Group Message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
            </>
          ) : chatType === 'broadcasts' && selectedBroadcast ? (
            <div className="flex-1 flex flex-col bg-background-card/20 p-6 space-y-4">
              <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-600/30 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{selectedBroadcast.title || 'Broadcast List'}</h3>
                    <p className="text-xs text-cyan-400 font-medium">Dispatched to {selectedBroadcast.recipientsCount} recipients</p>
                  </div>
                </div>
                <span className="text-xs text-slate-500">
                  {formatDistanceToNow(new Date(selectedBroadcast.createdAt), { addSuffix: true })}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded-full border border-cyan-500/30">
                  Dispatched Broadcast Content
                </span>
                <p className="text-sm text-white leading-relaxed whitespace-pre-line pt-2">
                  {selectedBroadcast.content}
                </p>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">💡 Broadcast Information:</p>
                <p>This message was delivered as individual 1-on-1 direct messages to each recipient. Replies from recipients will appear in your direct chat window.</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Group Creation Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        contacts={suggestions}
        onGroupCreated={(newGroup) => {
          queryClient.invalidateQueries({ queryKey: ['user-groups'] });
          setChatType('groups');
          setSelectedGroup(newGroup);
        }}
      />

      {/* Group Info & Management Modal */}
      {selectedGroup && (
        <GroupInfoModal
          isOpen={isGroupInfoOpen}
          onClose={() => setIsGroupInfoOpen(false)}
          group={selectedGroup}
          onGroupUpdated={(updated) => setSelectedGroup(updated)}
          onGroupDeleted={() => {
            setSelectedGroup(null);
            queryClient.invalidateQueries({ queryKey: ['user-groups'] });
          }}
          onGroupLeft={() => {
            setSelectedGroup(null);
            queryClient.invalidateQueries({ queryKey: ['user-groups'] });
          }}
        />
      )}

      {/* Broadcast Creation Modal */}
      <CreateBroadcastModal
        isOpen={isCreateBroadcastOpen}
        onClose={() => setIsCreateBroadcastOpen(false)}
        contacts={suggestions}
        onBroadcastSent={() => {
          queryClient.invalidateQueries({ queryKey: ['user-broadcasts'] });
          queryClient.invalidateQueries({ queryKey: ['messages'] });
          setChatType('broadcasts');
        }}
      />

      {/* Audio Phone Call & Video Call Modal */}
      {(callModalState.targetUser || selectedUser) && (
        <CallModal
          isOpen={callModalState.isOpen}
          onClose={() => setCallModalState((prev) => ({ ...prev, isOpen: false }))}
          targetUser={(callModalState.targetUser || selectedUser)!}
          callType={callModalState.type}
          direction={callModalState.direction}
          initialCallId={callModalState.callId}
          socket={realtimeSocket}
        />
      )}

      {/* GIF Picker Modal for Direct & Group Chats */}
      <GifPickerModal
        isOpen={isGifModalOpen}
        onClose={() => setIsGifModalOpen(false)}
        onSelectGif={(gifUrl) => {
          if (chatType === 'direct' && selectedUser) {
            sendDirectMessageMutation.mutate(`[GIF: ${gifUrl}]`);
          } else if (chatType === 'groups' && selectedGroup) {
            sendGroupMessageMutation.mutate(`[GIF: ${gifUrl}]`);
          }
        }}
      />
    </AppShell>
  );
};
