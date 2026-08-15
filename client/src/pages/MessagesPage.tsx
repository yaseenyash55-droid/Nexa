import React, { useState, useEffect, useRef } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialApi } from '../api/social.api.js';
import { usersApi } from '../api/users.api.js';
import { Message, User } from '../types/index.js';
import { Avatar } from '../components/ui/Avatar.js';
import { Send, MessageSquare, Search, CheckCheck, Check, Phone, Video } from 'lucide-react';
import { CallModal } from '../components/chat/CallModal.js';
import { useAuth } from '../contexts/AuthContext.js';
import { formatDistanceToNow } from 'date-fns';
import { io } from 'socket.io-client';
import { getAccessToken } from '../api/client.js';
import { useTheme } from '../contexts/ThemeContext.js';

export const MessagesPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { currentChatTheme } = useTheme();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [callModalState, setCallModalState] = useState<{ isOpen: boolean; type: 'audio' | 'video' }>({ isOpen: false, type: 'audio' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const readRequestsRef = useRef(new Set<number>());

  // Fetch contacts
  const { data: suggestions = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: () => usersApi.getSuggestions()
  });

  // Fetch active conversation messages
  const { data: messages = [], isLoading: isMessagesLoading } = useQuery({
    queryKey: ['messages', selectedUser?.userId],
    queryFn: () => (selectedUser ? socialApi.getMessagesWithUser(selectedUser.userId) : Promise.resolve([])),
    enabled: !!selectedUser?.userId
  });

  const sendMessageMutation = useMutation({
    mutationFn: () => socialApi.sendMessage(selectedUser!.userId, messageInput),
    onSuccess: (message) => {
      setMessageInput('');
      queryClient.setQueryData<Message[]>(['messages', selectedUser?.userId], (current = []) =>
        current.some((item) => item.messageId === message.messageId) ? current : [...current, message]
      );
    }
  });

  useEffect(() => {
    if (!currentUser) return;
    const token = getAccessToken();
    if (!token) return;

    const socket = io({ auth: { token }, withCredentials: true });
    socket.on('message:created', (message: Message) => {
      const otherUserId = message.senderId === currentUser.userId ? message.receiverId : message.senderId;
      queryClient.setQueryData<Message[]>(['messages', otherUserId], (current = []) =>
        current.some((item) => item.messageId === message.messageId) ? current : [...current, message]
      );
    });
    socket.on('message:read', ({ messageId }: { messageId: number }) => {
      queryClient.setQueriesData<Message[]>({ queryKey: ['messages'] }, (current = []) =>
        current.map((message) => message.messageId === messageId ? { ...message, isRead: true } : message)
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser, queryClient]);

  useEffect(() => {
    if (!currentUser || !selectedUser) return;
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
  }, [currentUser, messages, queryClient, selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
  };

  const filteredUsers = suggestions.filter(u =>
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell>
      <div className="h-[calc(100vh-4rem)] md:h-screen flex border-r border-slate-800/80 overflow-hidden">
        {/* Left Conversation List Sidebar */}
        <div className={`w-full md:w-80 border-r border-slate-800/80 flex flex-col bg-background-card/20 ${
          selectedUser ? 'hidden md:flex' : 'flex'
        }`}>
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-brand-400" /> Messages
              </h1>
              <span className="text-[10px] bg-brand-500/20 text-brand-300 font-bold px-2 py-0.5 rounded-full border border-brand-500/30">
                Direct Chat
              </span>
            </div>
            
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
            {filteredUsers.length === 0 ? (
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
                        <p className="text-xs font-bold text-white truncate">{u.displayName}</p>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">@{u.username}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Active Chat Window */}
        <div className={`flex-1 flex flex-col ${currentChatTheme.background} ${
          !selectedUser ? 'hidden md:flex items-center justify-center' : 'flex'
        }`}>
          {!selectedUser ? (
            <div className="text-center space-y-3 p-6 max-w-sm">
              <div className="p-4 bg-slate-800/40 rounded-full w-16 h-16 mx-auto flex items-center justify-center text-brand-400">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-white">Direct Messages</h2>
              <p className="text-xs text-slate-400">
                Select a user from the left panel to start a private conversation.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
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
                    <h3 className="text-sm font-bold text-white">{selectedUser.displayName}</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Direct conversation</p>
                  </div>
                </div>

                {/* Audio Phone Call & Video Call Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCallModalState({ isOpen: true, type: 'audio' })}
                    title="Start Phone Voice Call"
                    className="px-3 py-1.5 text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 rounded-xl transition-all border border-emerald-500/20 shadow-sm flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Phone className="w-4 h-4" />
                    <span className="hidden sm:inline">Phone Call</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCallModalState({ isOpen: true, type: 'video' })}
                    title="Start Video Call"
                    className="px-3 py-1.5 text-brand-300 hover:text-white bg-brand-600/20 hover:bg-brand-600 rounded-xl transition-all border border-brand-500/30 shadow-sm flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Video className="w-4 h-4" />
                    <span className="hidden sm:inline">Video Call</span>
                  </button>
                </div>
              </div>

              {/* Chat Messages Stream */}
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
                          <p className="leading-relaxed whitespace-pre-line">{m.content}</p>
                          <div className={`flex items-center justify-end gap-1 text-[9px] ${isSelf ? 'text-brand-200' : 'text-slate-400'}`}>
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
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (messageInput.trim()) {
                    sendMessageMutation.mutate();
                  }
                }}
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
                  disabled={!messageInput.trim() || sendMessageMutation.isPending}
                  className="p-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-xl shadow-glow-brand transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Audio Phone Call & Video Call Modal */}
      {selectedUser && (
        <CallModal
          isOpen={callModalState.isOpen}
          onClose={() => setCallModalState((prev) => ({ ...prev, isOpen: false }))}
          targetUser={selectedUser}
          callType={callModalState.type}
        />
      )}
    </AppShell>
  );
};
