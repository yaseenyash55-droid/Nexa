import React, { useState } from 'react';
import { User } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';
import { Button } from '../ui/Button.js';
import { MapPin, Link as LinkIcon, Calendar, Edit3 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users.api.js';

interface ProfileHeaderProps {
  user: User;
  onEditClick?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user, onEditClick }) => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const isSelf = currentUser?.userId === user.userId;
  const [isFollowing, setIsFollowing] = useState(user.isFollowing || false);

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

  return (
    <div className="border-b border-slate-800/80 bg-background-card/20 pb-4">
      {/* Cover Banner */}
      <div className="h-44 sm:h-56 w-full bg-gradient-to-r from-slate-900 via-brand-900/40 to-slate-900 relative">
        {user.coverImageUrl && (
          <img
            src={user.coverImageUrl.startsWith('/uploads') && window.location.origin.includes('surge.sh') ? `https://pick-sims-regions-plaza.trycloudflare.com${user.coverImageUrl}` : user.coverImageUrl}
            alt="Cover banner"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Avatar & Edit/Follow Actions */}
      <div className="px-4 sm:px-6 relative flex justify-between items-end -mt-16 sm:-mt-20 mb-4">
        <div className="relative">
          <Avatar
            src={user.profileImageUrl}
            name={user.displayName}
            size="xl"
            className="ring-4 ring-background shadow-2xl"
          />
        </div>

        {isSelf ? (
          <Button variant="outline" size="sm" onClick={onEditClick} leftIcon={<Edit3 className="w-4 h-4" />}>
            Edit Profile
          </Button>
        ) : (
          currentUser && (
            <Button
              variant={isFollowing ? 'outline' : 'primary'}
              size="sm"
              onClick={() => followMutation.mutate()}
              isLoading={followMutation.isPending}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
          )
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

        {/* Stats row */}
        <div className="flex items-center gap-6 text-xs pt-2">
          <div>
            <span className="font-bold text-white">{user.followingCount || 0}</span>{' '}
            <span className="text-slate-400">Following</span>
          </div>
          <div>
            <span className="font-bold text-white">{user.followersCount || 0}</span>{' '}
            <span className="text-slate-400">Followers</span>
          </div>
        </div>
      </div>
    </div>
  );
};
