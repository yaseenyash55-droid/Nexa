import React, { useState, useEffect, useRef } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialApi } from '../api/social.api.js';
import { usersApi } from '../api/users.api.js';
import { groupsApi, Group, GroupMessage } from '../api/groups.api.js';
import { broadcastsApi, Broadcast } from '../api/broadcasts.api.js';
import { Message, User } from '../types/index.js';
import { Avatar } from '../components/ui/Avatar.js';
import { Send, MessageSquare, Search, CheckCheck, Check, Phone, Video, ShieldCheck, Users, Plus, Radio } from 'lucide-react';
import { CallModal } from '../components/chat/CallModal.js';
import { CreateGroupModal } from '../components/chat/CreateGroupModal.js';
import { CreateBroadcastModal } from '../components/chat/CreateBroadcastModal.js';
import { useAuth } from '../contexts/AuthContext.js';
import { formatDistanceToNow } from 'date-fns';
import { io, Socket } from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';
import { API_BASE_URL, getAccessToken } from '../api/client.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { decryptMessage, DecryptedMessageResult } from '../utils/e2ee.js';

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

  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [callModalState, setCallModalState] = useState<{
    isOpen: boolean;
    type: 'audio' | 'video';
    direction: 'outgoing' | 'incoming';
    callId?: string;
    targetUser?: User;
  }>({ isOpen: false, type: 'audio', direction: 'outgoing' });

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

  // Fetch contacts (Direct Messages)
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

  // Send Direct Message (TLS-Protected)
  const sendDirectMessageMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser || !selectedUser || !messageInput.trim()) {
        throw new Error('Invalid send message state');
      }
      return socialApi.sendMessage(selectedUser.userId, messageInput.trim());
    },
    onSuccess: (message) => {
      setMessageInput('');
      queryClient.setQueryData<Message[]>(['messages', selectedUser?.userId], (current = []) =>
        current.some((item) => item.messageId === message.messageId) ? current : [...current, message]
      );
    }
  });

  // Send Group Message
  const sendGroupMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroup || !messageInput.trim()) {
        throw new Error('Invalid group message state');
      }
      return groupsApi.sendGroupMessage(selectedGroup.groupId, messageInput.trim());
    },
    onSuccess: (msg) => {
      setMessageInput('');
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
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;
    setRealtimeSocket(socket);

    socket.on('message:created', (message: Message) => {
      const otherUserId = message.senderId === currentUser.userId ? message.receiverId : message.senderId;
      queryClient.setQueryData<Message[]>(['messages', otherUserId], (current = []) =>
        current.some((item) => item.messageId === message.messageId) ? current : [...current, message]
      );
    });

    socket.on('group:message:created', (msg: GroupMessage) => {
      queryClient.setQueryData<GroupMessage[]>(['group-messages', msg.groupId], (current = []) =>
        current.some((item) => item.messageId === msg.messageId) ? current : [...current, msg]
      );
    });

    socket.on('message:read', ({ messageId }: { messageId: number }) => {
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

  const filteredUsers = suggestions.filter(u =>
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                    ? "Search contacts..."
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
            {chatType === 'direct' ? (
              filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No contacts found</div>
              ) : (
                filteredUsers.map((u) => {
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
                      <div className="flex-1 truncate">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                            {u.displayName}
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">@{u.username}</p>
                      </div>
                    </div>
                  );
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
                          <p className="leading-relaxed whitespace-pre-line">{decryptedInfo.text}</p>
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
                className="p-3 border-t border-slate-800/80 bg-background-card/60 flex items-center gap-2"
              >
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
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedGroup(null)}
                    className="md:hidden text-xs text-brand-400 font-semibold pr-2"
                  >
                    ← Back
                  </button>
                  <div className="w-9 h-9 rounded-full bg-brand-600/30 border border-brand-500/30 flex items-center justify-center text-brand-300 font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      {selectedGroup.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {selectedGroup.membersCount || 1} members {selectedGroup.description ? `• ${selectedGroup.description}` : ''}
                    </p>
                  </div>
                </div>
              </div>

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
                          <p className="leading-relaxed whitespace-pre-line">{m.content}</p>
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
              <form
                onSubmit={handleSendMessageSubmit}
                className="p-3 border-t border-slate-800/80 bg-background-card/60 flex items-center gap-2"
              >
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
    </AppShell>
  );
};
