import React from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { useQuery } from '@tanstack/react-query';
import { postsApi } from '../api/posts.api.js';
import { PostCard } from '../components/feed/PostCard.js';
import { PostSkeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Bookmark, Folder, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button.js';

export const BookmarksPage: React.FC = () => {
  const { data: bookmarksRes, isLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => postsApi.getBookmarks()
  });

  const posts = bookmarksRes?.data || [];

  return (
    <AppShell>
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-brand-600 to-aurora-cyan text-white rounded-xl shadow-glow-brand">
              <Bookmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Saved Bookmarks</h1>
              <p className="text-xs text-slate-400">All bookmarks saved to your Oracle Database profile repository</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled
            title="Custom category folders are currently unavailable in this release. All bookmarks are saved in Oracle."
          >
            Custom Folders (Unavailable)
          </Button>
        </div>

        {/* Informational Banner */}
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-brand-400" />
            <span>Active Collection: <strong>All Saved Posts ({posts.length})</strong></span>
          </div>
          <span className="aurora-badge text-[11px] px-2.5 py-0.5 rounded-full text-brand-300 border-brand-500/30 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Oracle 23ai Persisted
          </span>
        </div>

        {/* Bookmarked Posts List */}
        {isLoading ? (
          <PostSkeleton />
        ) : posts.length === 0 ? (
          <EmptyState
            title="No saved bookmarks"
            description="Click the bookmark icon on any post to save it to your Oracle repository."
          />
        ) : (
          <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-2xl overflow-hidden">
            {posts.map((post) => (
              <PostCard key={post.postId} post={post} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};
