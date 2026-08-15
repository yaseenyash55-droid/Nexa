import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell.js';
import { SearchInput } from '../components/search/SearchInput.js';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../api/users.api.js';
import { Avatar } from '../components/ui/Avatar.js';
import { Button } from '../components/ui/Button.js';
import { EmptyState } from '../components/ui/EmptyState.js';

export const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const { data: results, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => usersApi.search(query),
    enabled: !!query.trim()
  });

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6">
        <SearchInput initialQuery={query} />

        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-300">
            {query ? `Search Results for "${query}"` : 'Type a query to search'}
          </h2>

          {isLoading ? (
            <p className="text-xs text-slate-400 text-center py-6">Searching users...</p>
          ) : results && results.length > 0 ? (
            <div className="space-y-3">
              {results.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-3.5 bg-background-card/50 border border-slate-800/80 rounded-2xl hover:border-brand-500/30 transition-all"
                >
                  <Link to={`/profile/${user.username}`} className="flex items-center gap-3">
                    <Avatar src={user.profileImageUrl} name={user.displayName} size="md" />
                    <div>
                      <h4 className="text-sm font-bold text-white">{user.displayName}</h4>
                      <p className="text-xs text-slate-400">@{user.username}</p>
                      {user.bio && <p className="text-xs text-slate-300 line-clamp-1 mt-0.5">{user.bio}</p>}
                    </div>
                  </Link>
                  <Link to={`/profile/${user.username}`}>
                    <Button size="sm" variant="outline">
                      View Profile
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : query ? (
            <EmptyState title="No matching users found" description={`No creators match "${query}".`} />
          ) : null}
        </div>
      </div>
    </AppShell>
  );
};
