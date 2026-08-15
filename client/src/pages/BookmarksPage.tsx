import React, { useState } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { useQuery } from '@tanstack/react-query';
import { postsApi } from '../api/posts.api.js';
import { PostCard } from '../components/feed/PostCard.js';
import { PostSkeleton } from '../components/ui/Skeleton.js';
import { EmptyState } from '../components/ui/EmptyState.js';
import { Bookmark, FolderPlus, Folder, Sparkles, Plus } from 'lucide-react';
import { Modal } from '../components/ui/Modal.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';

export const BookmarksPage: React.FC = () => {
  const [collections, setCollections] = useState([
    { id: 'all', name: 'All Saved', count: 0 },
    { id: 'tech', name: 'Tech & Oracle', count: 1 },
    { id: 'design', name: 'UI/UX Inspiration', count: 1 },
    { id: 'favs', name: 'Favorites', count: 0 }
  ]);
  const [activeCollection, setActiveCollection] = useState('all');
  const [isAddCollectionOpen, setIsAddCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const { data: bookmarksRes, isLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => postsApi.getBookmarks()
  });

  const posts = bookmarksRes?.data || [];

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCollectionName.trim()) {
      const newCol = {
        id: newCollectionName.toLowerCase().replace(/\s+/g, '-'),
        name: newCollectionName.trim(),
        count: 0
      };
      setCollections([...collections, newCol]);
      setNewCollectionName('');
      setIsAddCollectionOpen(false);
    }
  };

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
              <h1 className="text-xl font-bold text-white tracking-tight">Saved Collections</h1>
              <p className="text-xs text-slate-400">Organize saved posts into custom bookmark collections</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setIsAddCollectionOpen(true)}
            leftIcon={<FolderPlus className="w-4 h-4" />}
          >
            New Collection
          </Button>
        </div>

        {/* Collections Tab Bar */}
        <div className="flex border-b border-slate-800/80 gap-2 overflow-x-auto pb-1 scrollbar-none">
          {collections.map((col) => {
            const isActive = activeCollection === col.id;
            return (
              <button
                key={col.id}
                onClick={() => setActiveCollection(col.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 select-none ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-glow-brand'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>{col.name}</span>
              </button>
            );
          })}
        </div>

        {/* Bookmarked Posts List */}
        {isLoading ? (
          <PostSkeleton />
        ) : posts.length === 0 ? (
          <EmptyState
            title="No saved bookmarks"
            description="Click the bookmark icon on any post to add it to your collections."
          />
        ) : (
          <div className="divide-y divide-slate-800/80 border border-slate-800/80 rounded-2xl overflow-hidden">
            {posts.map((post) => (
              <PostCard key={post.postId} post={post} />
            ))}
          </div>
        )}
      </div>

      {/* New Collection Modal */}
      <Modal isOpen={isAddCollectionOpen} onClose={() => setIsAddCollectionOpen(false)} title="Create Bookmark Collection">
        <form onSubmit={handleCreateCollection} className="space-y-4">
          <Input
            label="Collection Name"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="e.g. Architecture Insights, Product Design"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddCollectionOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!newCollectionName.trim()}>
              Create Collection
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
};
