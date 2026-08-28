import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Upload, CheckCircle2, AlertCircle, HelpCircle, Film, Loader2, Smile, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.js';
import { Avatar } from '../ui/Avatar.js';
import { Button } from '../ui/Button.js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '../../api/posts.api.js';
import { mediaApi } from '../../api/media.api.js';
import { getMediaUrl, handleImageError } from '../../utils/media.js';
import { EmojiPickerPopover } from '../ui/EmojiPickerPopover.js';
import { GifPickerModal } from '../ui/GifPickerModal.js';
import { AiWritingAssistantModal } from './AiWritingAssistantModal.js';

interface PostComposerProps {
  onPostCreated?: () => void;
}

export const PostComposer: React.FC<PostComposerProps> = ({ onPostCreated }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Restore drafts from browser localStorage
  const [content, setContent] = useState(() => {
    try {
      return localStorage.getItem('nexa_post_draft_content') || '';
    } catch {
      return '';
    }
  });

  const [imageUrl, setImageUrl] = useState(() => {
    try {
      return localStorage.getItem('nexa_post_draft_image') || '';
    } catch {
      return '';
    }
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isGifModalOpen, setIsGifModalOpen] = useState(false);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [showPostingGuide, setShowPostingGuide] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-persist drafts to browser localStorage
  useEffect(() => {
    try {
      if (content.trim()) {
        localStorage.setItem('nexa_post_draft_content', content);
      } else {
        localStorage.removeItem('nexa_post_draft_content');
      }
    } catch (_e) {}
  }, [content]);

  useEffect(() => {
    try {
      if (imageUrl) {
        localStorage.setItem('nexa_post_draft_image', imageUrl);
      } else {
        localStorage.removeItem('nexa_post_draft_image');
      }
    } catch (_e) {}
  }, [imageUrl]);

  const createPostMutation = useMutation({
    mutationFn: () => postsApi.createPost({ content, imageUrl }),
    onSuccess: () => {
      setContent('');
      setImageUrl('');
      try {
        localStorage.removeItem('nexa_post_draft_content');
        localStorage.removeItem('nexa_post_draft_image');
      } catch (_e) {}
      setFeedback({ type: 'success', text: 'Post published successfully!' });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      if (onPostCreated) onPostCreated();
      setTimeout(() => setFeedback(null), 5000);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to publish post';
      setFeedback({ type: 'error', text: msg });
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setFeedback(null);

      const kind = file.type.startsWith('video/') ? 'video' : 'photo';
      const uploadedUrl = await mediaApi.uploadFile(file, kind, (percent) => {
        setUploadProgress(percent);
      });

      setImageUrl(uploadedUrl);
      setFeedback({ type: 'success', text: 'Media file uploaded successfully!' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Media upload failed' });
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) return null;

  const characterCount = content.length;
  const maxCharacters = 2000;
  const isOverLimit = characterCount > maxCharacters;
  const isValid = (content.trim().length > 0 || imageUrl.trim().length > 0) && !isOverLimit && !isUploading;

  const resolvedMediaUrl = getMediaUrl(imageUrl);
  const isVideoMedia = resolvedMediaUrl && (
    resolvedMediaUrl.includes('/uploads/videos/') || 
    /\.(mp4|webm|mov|mkv|avi)$/i.test(resolvedMediaUrl)
  );

  return (
    <div className="p-4 bg-background-card/80 border border-slate-800/80 rounded-2xl shadow-xl space-y-4">
      {/* Feedback Banner Popup */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-80 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-start gap-3">
        <Avatar src={user.profileImageUrl} name={user.displayName} size="md" />
        <div className="flex-1 space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening in your network?"
            rows={3}
            className="w-full bg-transparent border-none text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-0 resize-none"
          />

          {/* Hidden File Picker Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*,.mp4,.webm,.mov,.mkv,.avi"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Upload Progress Bar */}
          {isUploading && (
            <div className="space-y-1.5 p-3 bg-slate-900/90 border border-brand-500/30 rounded-xl">
              <div className="flex items-center justify-between text-xs text-brand-300 font-semibold">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                  Uploading media...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-aurora-cyan transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Media Preview Card */}
          {resolvedMediaUrl && !isUploading && (
            <div className="relative rounded-xl overflow-hidden max-h-64 border border-slate-800 group bg-slate-950">
              {isVideoMedia ? (
                <video src={resolvedMediaUrl} controls className="w-full max-h-64 object-cover" />
              ) : (
                <img
                  src={resolvedMediaUrl}
                  alt="Uploaded media preview"
                  onError={handleImageError}
                  className="w-full h-full object-cover"
                />
              )}
              
              <div className="absolute top-2 right-2 z-10">
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="p-1.5 bg-slate-900/90 text-white hover:bg-rose-600 rounded-full transition-colors backdrop-blur-md shadow-lg"
                  title="Remove media"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expandable Posting Media Guide Widget */}
      {showPostingGuide && (
        <div className="p-3.5 bg-slate-900/90 rounded-xl border border-brand-500/30 text-xs space-y-2 text-slate-300">
          <div className="flex items-center justify-between font-bold text-white border-b border-slate-800 pb-1.5">
            <span className="flex items-center gap-1.5 text-brand-300">
              <Film className="w-4 h-4 text-brand-400" /> Footage & Media Posting Guide
            </span>
            <button onClick={() => setShowPostingGuide(false)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1">
            <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="font-semibold text-slate-100 block">1:1 Square Ratio</span>
              <span className="text-slate-400">Best for Instagram-style Grid posts.</span>
            </div>
            <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="font-semibold text-slate-100 block">4:5 Mobile Portrait</span>
              <span className="text-slate-400">Maximizes vertical feed space.</span>
            </div>
            <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="font-semibold text-slate-100 block">16:9 Landscape Video</span>
              <span className="text-slate-400">Best for wide video footages & cinema clips.</span>
            </div>
          </div>
        </div>
      )}

      {/* Composer Action Toolbar */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800/60 relative">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* File Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 bg-slate-900/40 border border-slate-800"
          >
            <Upload className="w-4 h-4 text-brand-400" />
            <span className="hidden sm:inline">{isUploading ? 'Uploading...' : 'Upload Media'}</span>
          </button>

          {/* Emoji Picker Popover Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
              className={`p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium border ${
                isEmojiPickerOpen
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60 bg-slate-900/40 border-slate-800'
              }`}
              title="Add Emoji"
            >
              <Smile className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Emoji</span>
            </button>

            <EmojiPickerPopover
              isOpen={isEmojiPickerOpen}
              onClose={() => setIsEmojiPickerOpen(false)}
              onSelectEmoji={(emoji) => {
                setContent((prev) => prev + emoji);
              }}
              position="top"
            />
          </div>

          {/* GIF Picker Button */}
          <button
            type="button"
            onClick={() => setIsGifModalOpen(true)}
            className="p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 bg-slate-900/40 border border-slate-800"
            title="Search & Attach GIF"
          >
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">GIF</span>
          </button>

          {/* ✨ Improve with NEXA AI Button */}
          <button
            type="button"
            onClick={() => setIsAiAssistantOpen(true)}
            className="p-2 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold text-aurora-cyan bg-brand-600/15 hover:bg-brand-600/30 border border-brand-500/40 hover:border-brand-500/60 shadow-sm"
            title="Improve with NEXA AI"
          >
            <Sparkles className="w-4 h-4 text-aurora-cyan animate-pulse-slow" />
            <span className="inline">✨ AI Write</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPostingGuide(!showPostingGuide)}
            className="p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-brand-300 hover:bg-slate-800/60"
            title="Posting & Media Advice"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">Guide</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-xs ${isOverLimit ? 'text-rose-400 font-bold' : 'text-slate-500'}`}>
            {characterCount} / {maxCharacters}
          </span>

          <Button
            size="sm"
            onClick={() => createPostMutation.mutate()}
            isLoading={createPostMutation.isPending}
            disabled={!isValid}
            rightIcon={<Sparkles className="w-4 h-4" />}
          >
            Post
          </Button>
        </div>

        {/* Search GIF Modal */}
        <GifPickerModal
          isOpen={isGifModalOpen}
          onClose={() => setIsGifModalOpen(false)}
          onSelectGif={(gifUrl) => {
            setImageUrl(gifUrl);
          }}
        />

        {/* ✨ NEXA AI Post Writing Assistant Modal */}
        <AiWritingAssistantModal
          isOpen={isAiAssistantOpen}
          onClose={() => setIsAiAssistantOpen(false)}
          currentText={content}
          onAccept={(suggestedText) => {
            setContent(suggestedText);
            setFeedback({ type: 'success', text: 'AI suggestion applied to your draft!' });
            setTimeout(() => setFeedback(null), 4000);
          }}
        />
      </div>
    </div>
  );
};
