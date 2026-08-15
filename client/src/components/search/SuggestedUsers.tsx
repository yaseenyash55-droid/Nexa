import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users.api.js';
import { Avatar } from '../ui/Avatar.js';
import { Button } from '../ui/Button.js';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.js';

export const SuggestedUsers: React.FC = () => {
  const { user: currentUser, requireAuth } = useAuth();
  const queryClient = useQueryClient();

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['suggestions'],
    queryFn: () => usersApi.getSuggestions(),
    enabled: !!currentUser
  });

  const followMutation = useMutation({
    mutationFn: (userId: number) => usersApi.follow(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    }
  });

  if (!currentUser || isLoading || !suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="bg-background-card border border-slate-800/80 rounded-2xl p-4 space-y-3">
      <h3 className="text-sm font-bold text-white tracking-wide">Who to Follow</h3>
      <div className="space-y-3">
        {suggestions.map((user) => (
          <div key={user.userId} className="flex items-center justify-between gap-3">
            <Link to={`/profile/${user.username}`} className="flex items-center gap-2.5 overflow-hidden group">
              <Avatar src={user.profileImageUrl} name={user.displayName} size="sm" />
              <div className="truncate">
                <p className="text-xs font-semibold text-white group-hover:text-brand-400 transition-colors truncate">
                  {user.displayName}
                </p>
                <p className="text-[11px] text-slate-400 truncate">@{user.username}</p>
              </div>
            </Link>
            <Button
              size="sm"
              variant="outline"
              onClick={() => requireAuth(() => followMutation.mutate(user.userId), `Log in to follow @${user.username}.`)}
              isLoading={followMutation.isPending}
            >
              Follow
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
