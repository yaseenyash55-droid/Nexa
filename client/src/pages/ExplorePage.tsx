import React from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { SuggestedUsers } from '../components/search/SuggestedUsers.js';
import { SearchInput } from '../components/search/SearchInput.js';
import { Compass } from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { PostCard } from '../components/feed/PostCard.js';

export const ExplorePage: React.FC = () => {
  const isExploreRoute = window.location.pathname === '/explore';

  const { data: exploreData = { posts: [], reels: [] } } = useQuery({
    queryKey: ['explore-mock'],
    queryFn: async () => {
      const res = await api.get('/explore/mock');
      return res.data.data;
    },
    enabled: isExploreRoute
  });

  const displayPosts = isExploreRoute ? exploreData.posts : [];

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800/80">
          <div className="p-2.5 bg-brand-600/20 text-brand-400 rounded-xl">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Explore & Discover</h1>
            <p className="text-xs text-slate-400">Find new connections and creators on Nexa</p>
          </div>
        </div>

        <SearchInput />

        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Suggested People</h2>
          <SuggestedUsers />
        </div>

        {displayPosts.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-800/50">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Trending on Nexa</h2>
            <div className="space-y-4">
              {displayPosts.map((post: any) => (
                <PostCard key={post.postId} post={post} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
