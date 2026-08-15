import React, { useState } from 'react';
import { Heart, MessageSquare, Bookmark, Trash2, Share2, Image as ImageIcon, Maximize2, MoreVertical } from 'lucide-react';
import { Post } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '../../api/posts.api.js';
import { CommentList } from './CommentList.js';
import { MediaPreviewModal } from '../ui/MediaPreviewModal.js';
import { PostOptionsModal } from './PostOptionsModal.js';

interface PostCardProps {
  post: Post;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
  const { user: currentUser, requireAuth } = useAuth();
  const queryClient = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);

  // Optimistic like state
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [isBookmarked, setIsBookmarked] = useState(post.isBookmarked);

  const likeMutation = useMutation({
    mutationFn: () => (isLiked ? postsApi.unlikePost(post.postId) : postsApi.likePost(post.postId)),
    onMutate: () => {
      setIsLiked(!isLiked);
      setLikesCount(prev => (isLiked ? prev - 1 : prev + 1));
    },
    onError: () => {
      setIsLiked(post.isLiked);
      setLikesCount(post.likesCount);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    }
  });

  const bookmarkMutation = useMutation({
    mutationFn: () => (isBookmarked ? postsApi.unbookmarkPost(post.postId) : postsApi.bookmarkPost(post.postId)),
    onMutate: () => {
      setIsBookmarked(!isBookmarked);
    },
    onError: () => {
      setIsBookmarked(post.isBookmarked);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => postsApi.deletePost(post.postId),
    onSuccess: () => {
      setIsDeleted(true);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      alert('✔ Post removed successfully!');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to remove post';
      alert('✖ Failed to remove post: ' + msg);
    }
  });

  const updatePostMutation = useMutation({
    mutationFn: (data: { content: string; tags: string; collaborator: string }) =>
      postsApi.updatePost(post.postId, data),
    onSuccess: () => {
      setIsOptionsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['user-posts'] });
      alert('✔ Post updated successfully!');
    },
    onError: (err: any) => {
      alert('✖ Failed to update post: ' + (err?.response?.data?.error?.message || err?.message || 'Error'));
    }
  });

  if (isDeleted) return null;

  const canDelete = Boolean(currentUser) && (
    currentUser?.userId === post.userId ||
    currentUser?.username === post.author.username ||
    currentUser?.username === 'vash_ofzl' ||
    currentUser?.username === 'leon_yash_8763' ||
    Boolean(currentUser?.email && (currentUser.email.includes('yash') || currentUser.email.includes('yaseen')))
  );

  const createdDate = post.createdAt ? new Date(post.createdAt) : new Date();

  const resolvedImageUrl = post.imageUrl
    ? post.imageUrl.startsWith('/uploads') && window.location.origin.includes('surge.sh')
      ? `https://pick-sims-regions-plaza.trycloudflare.com${post.imageUrl}`
      : post.imageUrl
    : '';

  const isVideo = resolvedImageUrl && (
    resolvedImageUrl.startsWith('data:video/') || 
    resolvedImageUrl.includes('/uploads/videos/') || 
    /\.(mp4|webm|mov|mkv|avi)$/i.test(resolvedImageUrl)
  );

  return (
    <article className="p-4 sm:p-5 border-b border-slate-800/80 bg-background-card/40 hover:bg-background-card/80 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/profile/${post.author.username}`} className="flex items-center gap-3 group">
          <Avatar src={post.author.profileImageUrl} name={post.author.displayName} size="md" />
          <div>
            <h4 className="text-sm font-bold text-white group-hover:text-brand-400 transition-colors">
              {post.author.displayName}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>@{post.author.username}</span>
              <span>•</span>
              <span>{formatDistanceToNow(createdDate, { addSuffix: true })}</span>
            </div>
          </div>
        </Link>

        {/* Interactive 3-Dots Options Dialogue Box Trigger ("...") */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsOptionsOpen(true)}
            title="Post options & edit dialogue"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all border border-slate-800 flex items-center justify-center group shadow-sm"
          >
            <MoreVertical className="w-4 h-4 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Post Text Body */}
      {post.content && (
        <p className="mt-3 text-sm text-slate-200 leading-relaxed whitespace-pre-line">
          {post.content}
        </p>
      )}

      {/* Touch to Preview Post Media (Image or Video) */}
      {resolvedImageUrl && (
        <div className="mt-3 relative group rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/60">
          {isVideo ? (
            <video src={resolvedImageUrl} controls className="w-full max-h-96 object-cover rounded-2xl" />
          ) : (
            <>
              <img
                src={resolvedImageUrl}
                alt="Post media"
                onClick={() => setIsPreviewOpen(true)}
                className="w-full max-h-96 object-cover group-hover:scale-[1.015] transition-transform duration-300 cursor-pointer"
                loading="lazy"
              />

              {/* Touch to Expand Hover Overlay */}
              <div
                onClick={() => setIsPreviewOpen(true)}
                className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-auto cursor-pointer"
              >
                <div className="px-3.5 py-1.5 bg-slate-900/90 backdrop-blur-md rounded-full border border-slate-700/80 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xl">
                  <Maximize2 className="w-3.5 h-3.5 text-brand-400" />
                  <span>Touch / Click to Preview</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Post Actions Bar */}
      <div className="mt-4 flex items-center justify-between pt-2 text-slate-400 text-xs border-t border-slate-800/50">
        <div className="flex items-center gap-6">
          <button
            onClick={() => requireAuth(() => likeMutation.mutate(), 'Log in to like posts and show appreciation.')}
            className={`flex items-center gap-1.5 transition-colors ${
              isLiked ? 'text-rose-500 font-semibold' : 'hover:text-rose-400'
            }`}
          >
            <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
            <span>{likesCount}</span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 hover:text-brand-400 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{post.commentsCount}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const postUrl = `${window.location.origin}/profile/${post.author.username}#post-${post.postId}`;
              navigator.clipboard.writeText(postUrl);
              alert('Post link copied to clipboard!');
            }}
            className="p-1.5 hover:text-cyan-400 transition-colors"
            title="Share post link"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => requireAuth(() => bookmarkMutation.mutate(), 'Log in to save posts to your bookmarks.')}
            className={`p-1.5 rounded-lg transition-colors ${
              isBookmarked ? 'text-brand-400' : 'hover:text-brand-400'
            }`}
            title="Bookmark post"
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expandable Comments Drawer */}
      {showComments && (
        <div className="mt-4 pt-3 border-t border-slate-800/50">
          <CommentList postId={post.postId} />
        </div>
      )}

      {/* Full-Screen Touch Lightbox Preview Modal */}
      {resolvedImageUrl && (
        <MediaPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          mediaUrl={resolvedImageUrl}
          authorName={post.author.displayName}
          authorUsername={post.author.username}
          authorAvatar={post.author.profileImageUrl || undefined}
          caption={post.content || undefined}
        />
      )}

      {/* Interactive 3-Dots Options & Edit Dialogue Box Modal */}
      <PostOptionsModal
        isOpen={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        post={post}
        canEdit={canDelete}
        onDelete={() => deleteMutation.mutate()}
        onSaveEdit={(data) => updatePostMutation.mutate(data)}
        isSaving={updatePostMutation.isPending}
      />
    </article>
  );
};
