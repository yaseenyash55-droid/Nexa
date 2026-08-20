import React, { useState, useEffect } from 'react';
import { Post } from '../../types/index.js';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { Trash2, Edit3, Tag, Users, Copy, Check, AlertTriangle } from 'lucide-react';

interface PostOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  canEdit: boolean;
  onDelete: () => void;
  onSaveEdit: (updatedData: { content: string; tags: string; collaborator: string }) => void;
  onReport?: () => void;
  isSaving?: boolean;
}

export const PostOptionsModal: React.FC<PostOptionsModalProps> = ({
  isOpen,
  onClose,
  post,
  canEdit,
  onDelete,
  onSaveEdit,
  onReport,
  isSaving = false
}) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'edit'>('menu');
  const [content, setContent] = useState(post.content || '');
  const [tags, setTags] = useState('');
  const [collaborator, setCollaborator] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('menu');
      setContent(post.content || '');
      setTags('');
      setCollaborator('');
      setCopied(false);
    }
  }, [isOpen, post]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/post/${post.postId}`;
    navigator.clipboard.writeText(postUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSave = () => {
    onSaveEdit({ content, tags, collaborator });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={activeTab === 'edit' ? 'Edit Post & Collab Options' : 'Post Dialogue Options'}>
      {activeTab === 'menu' ? (
        <div className="space-y-3 py-1">
          {/* Post Summary Preview Header */}
          <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-white">@{post.author.username}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 truncate max-w-[200px]">{post.content || 'Media Post'}</span>
            </div>
            <span className="px-2 py-0.5 bg-brand-500/20 text-brand-300 rounded-full font-semibold text-[10px]">
              ID #{post.postId}
            </span>
          </div>

          {/* Action Menu Items */}
          <div className="space-y-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className="w-full p-3 bg-slate-900/60 hover:bg-brand-600/20 border border-slate-800 hover:border-brand-500/40 rounded-xl text-left transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-600/20 rounded-lg text-brand-400 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Edit Caption & Content</p>
                    <p className="text-[10px] text-slate-400">Modify description text or details</p>
                  </div>
                </div>
                <span className="text-xs text-brand-400 font-semibold">Edit →</span>
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className="w-full p-3 bg-slate-900/60 hover:bg-cyan-600/20 border border-slate-800 hover:border-cyan-500/40 rounded-xl text-left transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-600/20 rounded-lg text-cyan-400 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Edit Tags & Hashtags</p>
                    <p className="text-[10px] text-slate-400">Add search tags or topic tags</p>
                  </div>
                </div>
                <span className="text-xs text-cyan-400 font-semibold">Tags →</span>
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className="w-full p-3 bg-slate-900/60 hover:bg-emerald-600/20 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-left transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-600/20 rounded-lg text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Invite Collaborator (Collab)</p>
                    <p className="text-[10px] text-slate-400">Co-author post with another user</p>
                  </div>
                </div>
                <span className="text-xs text-emerald-400 font-semibold">Collab →</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full p-3 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-lg text-slate-300 group-hover:text-white transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Copy Direct Link</p>
                  <p className="text-[10px] text-slate-400">Share direct post link</p>
                </div>
              </div>
              {copied && <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full">Copied!</span>}
            </button>

            {onReport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReport();
                }}
                className="w-full p-3 bg-amber-500/10 hover:bg-amber-600/20 border border-amber-500/30 rounded-xl text-left transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400 group-hover:text-white transition-colors">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-400 group-hover:text-white">Report Post</p>
                    <p className="text-[10px] text-amber-400/80 group-hover:text-white/80">Submit confidential report to moderation team</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-400 group-hover:text-white">Report</span>
              </button>
            )}

            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete();
                }}
                className="w-full p-3 bg-rose-500/10 hover:bg-rose-600 border border-rose-500/30 rounded-xl text-left transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-500/20 rounded-lg text-rose-400 group-hover:text-white transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-rose-400 group-hover:text-white">Delete Post</p>
                    <p className="text-[10px] text-rose-400/80 group-hover:text-white/80">Permanently remove post from database</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-rose-400 group-hover:text-white">Delete</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Edit Tab Form */
        <div className="space-y-4 py-1">
          {/* Edit Caption */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 text-brand-400" />
              <span>Edit Post Caption</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              placeholder="Write post content or description..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none resize-none"
            />
          </div>

          {/* Edit Tags */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>Add / Edit Hashtags</span>
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. #aurora, #art, #tech"
            />
            <p className="text-[10px] text-slate-500">Comma-separated tags will be attached to post</p>
          </div>

          {/* Invite Collaborator */}
          <div className="space-y-1.5 border-t border-slate-800/80 pt-3">
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Invite Collaborator (Collab Post)</span>
            </label>
            <Input
              value={collaborator}
              onChange={(e) => setCollaborator(e.target.value)}
              placeholder="Enter user handle"
            />
            <p className="text-[10px] text-slate-500">Collab badge and partner tag will appear on the post</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTab('menu')}>
              ← Back to Options
            </Button>
            <Button size="sm" onClick={handleSave} isLoading={isSaving}>
              Save Post Changes
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
