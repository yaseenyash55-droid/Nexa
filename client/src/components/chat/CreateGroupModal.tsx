import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';
import { X, Users, Search, Check, Loader2, UserPlus } from 'lucide-react';
import { groupsApi, Group } from '../../api/groups.api.js';
import { usersApi } from '../../api/users.api.js';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: User[];
  onGroupCreated: (group: Group) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onGroupCreated
}) => {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Map<number, User>>(new Map());
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [localSuggestions, setLocalSuggestions] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when opening/closing and fetch suggestions if empty
  useEffect(() => {
    if (!isOpen) {
      setGroupName('');
      setDescription('');
      setSearchQuery('');
      setSelectedUsers(new Map());
      setSearchResults([]);
      setIsSearching(false);
      setError(null);
    } else if (!contacts || contacts.length === 0) {
      usersApi.getSuggestions().then((suggs) => {
        if (suggs && suggs.length > 0) {
          setLocalSuggestions(suggs);
        }
      }).catch(() => {});
    }
  }, [isOpen, contacts]);

  // Debounced dynamic user search
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
        const cleanQuery = query.replace(/^[@#]+/, '').trim();
        const results = await usersApi.search(cleanQuery || query);
        const combined = [...results];

        // If numeric ID and not found in general search, try direct getById
        const numericId = parseInt(cleanQuery, 10);
        if (!isNaN(numericId) && numericId > 0 && !combined.some((u) => u.userId === numericId)) {
          try {
            const userById = await usersApi.getById(numericId);
            if (userById && !combined.some((u) => u.userId === userById.userId)) {
              combined.unshift(userById);
            }
          } catch {
            // User ID not found, ignore
          }
        }

        // Also merge any local contacts or suggestions matching query if not already present
        const sourceContacts = contacts && contacts.length > 0 ? contacts : localSuggestions;
        const localMatches = sourceContacts.filter((c) =>
          (c.displayName.toLowerCase().includes(cleanQuery.toLowerCase()) ||
           c.username.toLowerCase().includes(cleanQuery.toLowerCase()) ||
           c.userId.toString() === cleanQuery) &&
          !combined.some((u) => u.userId === c.userId)
        );

        setSearchResults([...combined, ...localMatches]);
      } catch (err: any) {
        console.warn('User search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, isOpen, contacts, localSuggestions]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }

    const memberIds = Array.from(selectedUsers.keys());

    try {
      setIsSubmitting(true);
      setError(null);
      const newGroup = await groupsApi.createGroup({
        name: groupName.trim(),
        description: description.trim() || undefined,
        memberIds
      });

      onGroupCreated(newGroup);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  // When search query is empty, show initial suggestions/contacts; otherwise show searchResults
  const displayList = searchQuery.trim().length > 0
    ? searchResults
    : (contacts && contacts.length > 0 ? contacts : localSuggestions);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-400" />
            <h2 className="text-base font-bold text-white">Create New Group Chat</h2>
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">Group Name *</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Engineering Squad / Design Hub"
              className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Add Members ({selectedUsers.size} selected)
              </label>
              {selectedUsers.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedUsers(new Map())}
                  className="text-[11px] text-slate-400 hover:text-red-400 transition"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Selected Members Chips */}
            {selectedUsers.size > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 mb-2 bg-slate-950/80 border border-brand-500/20 rounded-xl max-h-24 overflow-y-auto">
                {Array.from(selectedUsers.values()).map((user) => (
                  <div
                    key={user.userId}
                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-brand-600/20 border border-brand-500/40 rounded-lg text-[11px] text-brand-200"
                  >
                    <Avatar src={user.profileImageUrl} name={user.displayName} size="xs" />
                    <span className="font-semibold truncate max-w-[90px]">{user.displayName}</span>
                    <button
                      type="button"
                      onClick={() => removeUser(user.userId)}
                      className="text-brand-400 hover:text-white transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, @username, or User ID..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 absolute right-3 top-3 text-brand-400 animate-spin" />
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

            {/* Users List */}
            <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/60 border border-slate-800 rounded-xl bg-slate-950">
              {displayList.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                  {isSearching ? (
                    <p>Searching users...</p>
                  ) : searchQuery.trim() ? (
                    <>
                      <p>No users found matching &quot;{searchQuery}&quot;</p>
                      <p className="text-[10px] text-slate-600">Try searching by full username or User ID</p>
                    </>
                  ) : (
                    <p>Search users to add members</p>
                  )}
                </div>
              ) : (
                displayList.map((contact) => {
                  const isSelected = selectedUsers.has(contact.userId);
                  return (
                    <div
                      key={contact.userId}
                      onClick={() => toggleUser(contact)}
                      className={`p-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-brand-600/15' : 'hover:bg-slate-900'
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
                            ? 'bg-brand-600 border-brand-500 text-white'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3 h-3 text-slate-500" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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
              disabled={isSubmitting || !groupName.trim()}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-glow-brand transition-colors"
            >
              {isSubmitting ? 'Creating...' : selectedUsers.size > 0 ? `Create Group (${selectedUsers.size + 1} members)` : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
