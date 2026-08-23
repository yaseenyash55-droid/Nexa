import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';
import { Button } from '../ui/Button.js';
import { MapPin, Link as LinkIcon, Calendar, Edit3, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users.api.js';
import { getMediaUrl, handleImageError } from '../../utils/media.js';
import { FollowersFollowingModal, FollowModalTab } from './FollowersFollowingModal.js';

interface ProfileHeaderProps {
  user: User;
  onEditClick?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user, onEditClick }) => {
  const { user: currentUser, requireAuth } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isSelf = currentUser?.userId === user.userId;
  const [isFollowing, setIsFollowing] = useState(user.isFollowing || false);
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<FollowModalTab>('followers');

  const openFollowModal = (tab: FollowModalTab) => {
    setFollowModalTab(tab);
    setIsFollowModalOpen(true);
  };

  const followMutation = useMutation({
    mutationFn: () => (isFollowing ? usersApi.unfollow(user.userId) : usersApi.follow(user.userId)),
    onMutate: () => {
      setIsFollowing(!isFollowing);
    },
    onError: () => {
      setIsFollowing(user.isFollowing || false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user.username] });
    }
  });

  const joinedDate = user.createdAt ? new Date(user.createdAt) : new Date();
  const coverUrl = getMediaUrl(user.coverImageUrl);
  const avatarUrl = getMediaUrl(user.profileImageUrl);

  return (
    <div className="border-b border-slate-800/80 bg-background-card/20 pb-4">
      {/* Cover Banner */}
      <div className="h-44 sm:h-56 w-full bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 relative overflow-hidden">
        {coverUrl && (
          <img
            src={coverUrl}
            alt="Cover banner"
            onError={handleImageError}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Avatar & Edit/Follow Actions */}
      <div className="px-4 sm:px-6 relative flex justify-between items-end -mt-16 sm:-mt-20 mb-4">
        <div className="relative">
          <Avatar
            src={avatarUrl}
            name={user.displayName}
            size="xl"
            className="ring-4 ring-slate-950 shadow-2xl"
          />
        </div>

        {isSelf ? (
          <Button variant="outline" size="sm" onClick={onEditClick} leftIcon={<Edit3 className="w-4 h-4" />}>
            Edit Profile
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<MessageSquare className="w-4 h-4" />}
              onClick={() =>
                requireAuth(
                  () => navigate(`/messages?userId=${user.userId}`),
                  `Log in to message @${user.username}.`
                )
              }
            >
              Message
            </Button>
            <Button
              variant={isFollowing ? 'outline' : 'primary'}
              size="sm"
              onClick={() => requireAuth(() => followMutation.mutate(), `Log in to follow @${user.username}.`)}
              isLoading={followMutation.isPending}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          </div>
        )}
      </div>

      {/* User Details */}
      <div className="px-4 sm:px-6 space-y-3">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">{user.displayName}</h2>
          <p className="text-xs text-slate-400">@{user.username}</p>
        </div>

        {user.bio && (
          <p className="text-sm text-slate-200 leading-relaxed max-w-2xl">{user.bio}</p>
        )}

        {/* User Meta Infos */}
        <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-400 pt-1">
          {user.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>{user.location}</span>
            </div>
          )}

          {user.websiteUrl && (
            <div className="flex items-center gap-1">
              <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
              <a href={user.websiteUrl} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">
                {user.websiteUrl.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Joined {format(joinedDate, 'MMMM yyyy')}</span>
          </div>
        </div>

        {/* Stats row with interactive follower / following triggers */}
        <div className="flex items-center gap-6 text-xs pt-2">
          <button
            type="button"
            onClick={() => openFollowModal('following')}
            className="hover:underline text-left group transition-colors"
          >
            <span className="font-bold text-white group-hover:text-brand-400 transition-colors">
              {user.followingCount || 0}
            </span>{' '}
            <span className="text-slate-400">Following</span>
          </button>
          <button
            type="button"
            onClick={() => openFollowModal('followers')}
            className="hover:underline text-left group transition-colors"
          >
            <span className="font-bold text-white group-hover:text-brand-400 transition-colors">
              {user.followersCount || 0}
            </span>{' '}
            <span className="text-slate-400">Followers</span>
          </button>
        </div>
      </div>

      {/* Followers & Following Modal */}
      <FollowersFollowingModal
        isOpen={isFollowModalOpen}
        onClose={() => setIsFollowModalOpen(false)}
        userId={user.userId}
        username={user.username}
        initialTab={followModalTab}
      />
    </div>
  );
};

