import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';
import { X, Radio, Search, Check, Send, Loader2 } from 'lucide-react';
import { broadcastsApi, Broadcast } from '../../api/broadcasts.api.js';
import { usersApi } from '../../api/users.api.js';

interface CreateBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: User[];
  onBroadcastSent: (result: { broadcast: Broadcast; messagesCount: number }) => void;
}

export const CreateBroadcastModal: React.FC<CreateBroadcastModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onBroadcastSent
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Map<number, User>>(new Map());
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setMessage('');
      setSearchQuery('');
      setSelectedUsers(new Map());
      setSearchResults([]);
      setIsSearching(false);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const query = searchQuery.trim();

    if (!query) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await usersApi.search(query);
        const combined = [...results];

        if (combined.length === 0 && /^\d+$/.test(query)) {
          try {
            const userById = await usersApi.getById(parseInt(query, 10));
            if (userById) {
              combined.push(userById);
            }
          } catch {
            // Ignore
          }
        }

        const localMatches = contacts.filter((c) =>
          (c.displayName.toLowerCase().includes(query.toLowerCase()) ||
           c.username.toLowerCase().includes(query.toLowerCase()) ||
           c.userId.toString() === query) &&
          !combined.some((u) => u.userId === c.userId)
        );

        setSearchResults([...combined, ...localMatches]);
      } catch (err: any) {
        console.warn('User search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, isOpen, contacts]);

  if (!isOpen) return null;

  const toggleUser = (user: User) => {
    setSelectedUsers((prev) => {
      const next = new Map(prev);
      if (next.has(user.userId)) {
        next.delete(user.userId);
      } else {
        next.set(user.userId, user);
      }
      return next;
    });
  };

  const removeUser = (userId: number) => {
    setSelectedUsers((prev) => {
      const next = new Map(prev);
      next.delete(userId);
      return next;
    });
  };

  const handleSelectAll = () => {
    const listToUse = searchQuery.trim() ? searchResults : contacts;
    if (selectedUsers.size === listToUse.length && listToUse.length > 0) {
      setSelectedUsers(new Map());
    } else {
      const next = new Map(selectedUsers);
      listToUse.forEach((u) => next.set(u.userId, u));
      setSelectedUsers(next);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.size === 0) {
      setError('Please select at least one recipient');
      return;
    }
    if (!message.trim()) {
      setError('Broadcast message cannot be empty');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const result = await broadcastsApi.createBroadcast({
        title: title.trim() || undefined,
        recipientIds: Array.from(selectedUsers.keys()),
        message: message.trim()
      });

      onBroadcastSent(result);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to dispatch broadcast');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayList = searchQuery.trim().length > 0 ? searchResults : contacts;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">New Broadcast List</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 flex-1 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Broadcast Title (Optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Project Update / Event Invitation"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Select Recipients ({selectedUsers.size} selected)
              </label>
              {displayList.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] text-cyan-400 font-bold hover:underline"
                >
                  {selectedUsers.size === displayList.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {/* Selected Recipients Chips */}
            {selectedUsers.size > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 mb-2 bg-slate-950/80 border border-cyan-500/20 rounded-xl max-h-24 overflow-y-auto">
                {Array.from(selectedUsers.values()).map((user) => (
                  <div
                    key={user.userId}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-cyan-600/20 border border-cyan-500/40 rounded-lg text-[11px] text-cyan-200"
                  >
                    <Avatar src={user.profileImageUrl} name={user.displayName} size="xs" />
                    <span className="font-semibold truncate max-w-[90px]">{user.displayName}</span>
                    <button
                      type="button"
                      onClick={() => removeUser(user.userId)}
                      className="text-cyan-400 hover:text-white transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, @username, or User ID..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 absolute right-3 top-3 text-cyan-400 animate-spin" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800 rounded-xl bg-slate-950">
              {displayList.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  {isSearching ? 'Searching users...' : 'No contacts found'}
                </div>
              ) : (
                displayList.map((contact) => {
                  const isSelected = selectedUsers.has(contact.userId);
                  return (
                    <div
                      key={contact.userId}
                      onClick={() => toggleUser(contact)}
                      className={`p-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-cyan-500/15' : 'hover:bg-slate-900'
                      }`}
                    >
                      <Avatar src={contact.profileImageUrl} name={contact.displayName} size="sm" />
                      <div className="flex-1 truncate">
                        <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                          {contact.displayName}
                          <span className="text-[10px] font-normal text-slate-500">#{contact.userId}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">@{contact.username}</p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-cyan-600 border-cyan-500 text-white'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Message Content *</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message... (Recipients will receive this as an individual 1-on-1 direct message)"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedUsers.size === 0 || !message.trim()}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-glow-cyan transition-colors flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Dispatching...' : `Send to ${selectedUsers.size} users`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
