import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, X, Users, UserCheck, RefreshCw, AlertCircle, MessageSquare } from 'lucide-react';
import { usersApi } from '../../api/users.api.js';
import { User } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';
import { Button } from '../ui/Button.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { getMediaUrl } from '../../utils/media.js';

export type FollowModalTab = 'followers' | 'following';

interface FollowersFollowingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  username: string;
  initialTab?: FollowModalTab;
}

export const FollowersFollowingModal: React.FC<FollowersFollowingModalProps> = ({
  isOpen,
  onClose,
  userId,
  username,
  initialTab = 'followers'
}) => {
  const [activeTab, setActiveTab] = useState<FollowModalTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const { user: currentUser, requireAuth } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Synchronize initialTab whenever modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchQuery('');
    }
  }, [isOpen, initialTab]);

  // Handle ESC key and backdrop lock
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Fetch followers
  const {
    data: followers = [],
    isLoading: isFollowersLoading,
    isError: isFollowersError,
    refetch: refetchFollowers
  } = useQuery({
    queryKey: ['user-followers', userId],
    queryFn: () => usersApi.getFollowers(userId),
    enabled: isOpen && activeTab === 'followers'
  });

  // Fetch following
  const {
    data: following = [],
    isLoading: isFollowingLoading,
    isError: isFollowingError,
    refetch: refetchFollowing
  } = useQuery({
    queryKey: ['user-following', userId],
    queryFn: () => usersApi.getFollowing(userId),
    enabled: isOpen && activeTab === 'following'
  });

  const currentList = activeTab === 'followers' ? followers : following;
  const isLoading = activeTab === 'followers' ? isFollowersLoading : isFollowingLoading;
  const isError = activeTab === 'followers' ? isFollowersError : isFollowingError;
  const refetch = activeTab === 'followers' ? refetchFollowers : refetchFollowing;

  // Filtered by search
  const filteredUsers = currentList.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.displayName && u.displayName.toLowerCase().includes(q))
    );
  });

  // Toggle follow mutation
  const followMutation = useMutation({
    mutationFn: ({ targetUserId, isCurrentlyFollowing }: { targetUserId: number; isCurrentlyFollowing: boolean }) =>
      isCurrentlyFollowing ? usersApi.unfollow(targetUserId) : usersApi.follow(targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-followers'] });
      queryClient.invalidateQueries({ queryKey: ['user-following'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  });

  if (!isOpen) return null;

  const handleUserClick = (targetUsername: string) => {
    onClose();
    navigate(`/profile/${targetUsername}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-modal-title"
        className="relative w-full max-w-md bg-slate-950/95 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <h3 id="follow-modal-title" className="text-base font-bold text-white tracking-tight">
              @{username}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center border-b border-slate-800/80 bg-slate-900/40">
          <button
            type="button"
            onClick={() => setActiveTab('followers')}
            className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 border-b-2 ${
              activeTab === 'followers'
                ? 'text-white border-brand-500 bg-brand-500/10'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Followers ({followers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('following')}
            className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-2 border-b-2 ${
              activeTab === 'following'
                ? 'text-white border-brand-500 bg-brand-500/10'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Following ({following.length})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="px-4 py-2.5 border-b border-slate-800/60 bg-slate-900/20">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Users List Body */}
        <div className="overflow-y-auto flex-1 p-2 space-y-1 divide-y divide-slate-800/30">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800" />
                    <div className="space-y-1.5">
                      <div className="w-24 h-3 bg-slate-800 rounded" />
                      <div className="w-16 h-2.5 bg-slate-800/60 rounded" />
                    </div>
                  </div>
                  <div className="w-20 h-7 bg-slate-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="p-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="text-xs text-slate-300">Failed to load {activeTab}. Please try again.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Retry
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-semibold text-slate-300">
                {searchQuery
                  ? 'No matching users found'
                  : activeTab === 'followers'
                  ? 'No followers yet'
                  : 'Not following anyone yet'}
              </p>
              <p className="text-[11px] text-slate-500">
                {searchQuery ? 'Try searching for a different name or username.' : 'New connections will show up here.'}
              </p>
            </div>
          ) : (
            filteredUsers.map((itemUser: User) => {
              const isSelf = currentUser?.userId === itemUser.userId;
              const isItemFollowing = itemUser.isFollowing || false;
              const avatarUrl = getMediaUrl(itemUser.profileImageUrl);

              return (
                <div
                  key={itemUser.userId}
                  className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-900/60 transition-all gap-3 group"
                >
                  {/* User Profile Info */}
                  <div
                    onClick={() => handleUserClick(itemUser.username)}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    <Avatar
                      src={avatarUrl}
                      name={itemUser.displayName || itemUser.username}
                      size="md"
                      className="shrink-0 ring-2 ring-slate-800 group-hover:ring-brand-500 transition-all"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate hover:underline">
                        {itemUser.displayName || itemUser.username}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">@{itemUser.username}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isSelf && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            requireAuth(
                              () => navigate(`/messages?userId=${itemUser.userId}`),
                              `Log in to message @${itemUser.username}.`
                            );
                          }}
                          className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors"
                          title={`Message @${itemUser.username}`}
                          aria-label={`Message @${itemUser.username}`}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <Button
                          variant={isItemFollowing ? 'outline' : 'primary'}
                          size="sm"
                          className="text-xs px-3 py-1 h-8 rounded-xl font-bold"
                          isLoading={
                            followMutation.isPending &&
                            followMutation.variables?.targetUserId === itemUser.userId
                          }
                          onClick={() =>
                            requireAuth(
                              () =>
                                followMutation.mutate({
                                  targetUserId: itemUser.userId,
                                  isCurrentlyFollowing: isItemFollowing
                                }),
                              `Log in to follow @${itemUser.username}.`
                            )
                          }
                        >
                          {isItemFollowing ? 'Following' : 'Follow'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
