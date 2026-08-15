import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '../../api/posts.api.js';
import { Avatar } from '../ui/Avatar.js';
import { Button } from '../ui/Button.js';
import { useAuth } from '../../contexts/AuthContext.js';
import { Trash2, Send, LogIn } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

export const CommentList: React.FC<{ postId: number }> = ({ postId }) => {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');

  const { data: commentsRes, isLoading } = useQuery({
    queryKey: ['comments', postId],
    queryFn: () => postsApi.getComments(postId)
  });

  const addCommentMutation = useMutation({
    mutationFn: () => postsApi.addComment(postId, content),
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    }
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: number) => postsApi.deleteComment(postId, commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    }
  });

  const comments = commentsRes?.data || [];

  return (
    <div className="space-y-4">
      {/* Comment Input or Unauthenticated Banner */}
      {currentUser ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (content.trim()) addCommentMutation.mutate();
          }}
          className="flex items-center gap-2"
        >
          <Avatar src={currentUser.profileImageUrl} name={currentUser.displayName} size="sm" />
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
          <Button
            type="submit"
            size="sm"
            isLoading={addCommentMutation.isPending}
            disabled={!content.trim()}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      ) : (
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-400">Log in or sign up to join the conversation and comment.</span>
          <Link
            to="/login"
            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-lg shrink-0 transition-colors flex items-center gap-1"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Log in</span>
          </Link>
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <p className="text-xs text-slate-500 text-center py-2">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-2">No comments yet. Be the first to comment!</p>
      ) : (
        <div className="space-y-3 pt-2">
          {comments.map((comment) => {
            const isOwner = currentUser?.userId === comment.userId;
            const createdDate = comment.createdAt ? new Date(comment.createdAt) : new Date();

            return (
              <div key={comment.commentId} className="flex items-start justify-between gap-2.5 p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/40">
                <div className="flex items-start gap-2.5">
                  <Avatar src={comment.author.profileImageUrl} name={comment.author.displayName} size="sm" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">{comment.author.displayName}</span>
                      <span className="text-[10px] text-slate-500">@{comment.author.username}</span>
                      <span className="text-[10px] text-slate-500">• {formatDistanceToNow(createdDate, { addSuffix: true })}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{comment.content}</p>
                  </div>
                </div>

                {isOwner && (
                  <button
                    onClick={() => deleteCommentMutation.mutate(comment.commentId)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Delete comment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
