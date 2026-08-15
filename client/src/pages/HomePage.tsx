import React, { useState } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { StoriesBar } from '../components/stories/StoriesBar.js';
import { FeedTabs } from '../components/feed/FeedTabs.js';
import { PostComposer } from '../components/feed/PostComposer.js';
import { PostCard } from '../components/feed/PostCard.js';
import { PostSkeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { useAuth } from '../contexts/AuthContext.js';
import { useInfiniteQuery } from '@tanstack/react-query';
import { postsApi } from '../api/posts.api.js';
import { Button } from '../components/ui/Button.js';

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [scope, setScope] = useState<'global' | 'following'>('global');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch
  } = useInfiniteQuery({
    queryKey: ['feed', scope],
    queryFn: ({ pageParam }) => postsApi.getFeed(scope, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta?.hasMore ? (lastPage.meta.nextCursor as number) : undefined)
  });

  const posts = data?.pages.flatMap((page) => page.data) || [];

  return (
    <AppShell>
      <StoriesBar />

      <FeedTabs activeTab={scope} onChange={setScope} isAuthenticated={!!user} />

      <div className="p-4 space-y-4">
        {user && <PostComposer />}

        {isLoading ? (
          <div className="space-y-4">
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </div>
        ) : isError ? (
          <div className="text-center p-8 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-3">
            <p className="text-sm text-rose-300 font-semibold">Failed to load feed</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description={scope === 'following' ? "You aren't following anyone with posts yet." : "Be the first person to share a post on Nexa!"}
          />
        ) : (
          <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-2xl overflow-hidden">
            {posts.map((post) => (
              <PostCard key={post.postId} post={post} />
            ))}
          </div>
        )}

        {hasNextPage && (
          <div className="pt-4 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              isLoading={isFetchingNextPage}
            >
              Load More Posts
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
};
