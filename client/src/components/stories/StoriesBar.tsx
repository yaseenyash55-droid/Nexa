import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialApi } from '../../api/social.api.js';
import { Story } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';
import { Plus, X, Upload, Sparkles, ChevronLeft, ChevronRight, Eye, Heart, Flame, ThumbsUp, Users } from 'lucide-react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { readMediaAsDataUrl } from '../../utils/mediaUpload.js';

export const StoriesBar: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddStoryOpen, setIsAddStoryOpen] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [isCloseFriendsOnly, setIsCloseFriendsOnly] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState<{ username: string; stories: Story[] } | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [reactedEmoji, setReactedEmoji] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stories = [] } = useQuery({
    queryKey: ['stories'],
    queryFn: () => socialApi.getFeedStories(),
    refetchInterval: 30000
  });

  const createStoryMutation = useMutation({
    mutationFn: async () => {
      if (!mediaUrl) throw new Error('Choose an image or video first');
      return socialApi.createStory({ mediaUrl, caption });
    },
    onSuccess: () => {
      setMediaUrl('');
      setMediaFile(null);
      setCaption('');
      setIsCloseFriendsOnly(false);
      setIsAddStoryOpen(false);
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      alert('✔ Story shared successfully!');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to share story';
      alert('✖ Failed to share story: ' + msg);
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readMediaAsDataUrl(file);
      setMediaFile(file);
      setMediaUrl(dataUrl);
    } catch (err: any) {
      alert(err.message || 'Failed to load media file');
    }
  };

  // Group stories by author
  const groupedStories: Record<string, { author: Story['author']; stories: Story[] }> = {};
  stories.forEach((story) => {
    const uname = story.author.username;
    if (!groupedStories[uname]) {
      groupedStories[uname] = { author: story.author, stories: [] };
    }
    groupedStories[uname].stories.push(story);
  });

  const openStoryViewer = (uname: string) => {
    const group = groupedStories[uname];
    if (group && group.stories.length > 0) {
      setActiveStoryGroup({ username: uname, stories: group.stories });
      setActiveStoryIndex(0);
      setReactedEmoji(null);
    }
  };

  const handleNextStory = () => {
    if (!activeStoryGroup) return;
    if (activeStoryIndex < activeStoryGroup.stories.length - 1) {
      setActiveStoryIndex(prev => prev + 1);
      setReactedEmoji(null);
    } else {
      setActiveStoryGroup(null);
    }
  };

  const handlePrevStory = () => {
    if (!activeStoryGroup) return;
    if (activeStoryIndex > 0) {
      setActiveStoryIndex(prev => prev - 1);
      setReactedEmoji(null);
    }
  };

  const currentStory = activeStoryGroup?.stories[activeStoryIndex];

  return (
    <div className="p-4 bg-background-card/40 border-b border-slate-800/80 overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-4 min-w-max">
        {/* Current User Add Story Ring */}
        {user && (
          <div className="flex flex-col items-center gap-1.5 cursor-pointer group" onClick={() => setIsAddStoryOpen(true)}>
            <div className="relative p-0.5 rounded-full border-2 border-dashed border-brand-500/60 group-hover:border-brand-400 transition-colors">
              <Avatar src={user.profileImageUrl} name={user.displayName} size="lg" />
              <div className="absolute bottom-0 right-0 p-1 bg-brand-600 text-white rounded-full border-2 border-background shadow-lg">
                <Plus className="w-3 h-3" />
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-300 group-hover:text-white">Your Story</span>
          </div>
        )}

        {/* Grouped Author Stories */}
        {Object.entries(groupedStories).map(([uname, group]) => (
          <div
            key={uname}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
            onClick={() => openStoryViewer(uname)}
          >
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-brand-500 via-aurora-pink to-aurora-cyan group-hover:scale-105 transition-transform shadow-glow-brand">
              <div className="p-0.5 bg-background rounded-full">
                <Avatar src={group.author.profileImageUrl} name={group.author.displayName} size="lg" />
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-300 group-hover:text-white truncate max-w-[70px]">
              {group.author.displayName}
            </span>
          </div>
        ))}
      </div>

      {/* Add Story Modal */}
      <Modal isOpen={isAddStoryOpen} onClose={() => setIsAddStoryOpen(false)} title="Create 24h Story">
        <div className="space-y-4">
          <p className="text-xs text-slate-400">Stories disappear automatically after 24 hours.</p>
          
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {mediaUrl ? (
            <div className="relative rounded-2xl overflow-hidden max-h-72 border border-brand-500/50">
              <img src={mediaUrl} alt="Story preview" className="w-full h-full object-cover" />
              <button
                onClick={() => { URL.revokeObjectURL(mediaUrl); setMediaUrl(''); setMediaFile(null); }}
                className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-full hover:bg-rose-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-44 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 hover:bg-slate-800/60 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <Upload className="w-8 h-8 text-brand-400" />
              <span className="text-xs font-semibold">Upload Image from Local Device</span>
            </button>
          )}

          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a story caption..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
          />

          {/* Close Friends Audience Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Share with Close Friends only</span>
            </div>
            <button
              type="button"
              onClick={() => setIsCloseFriendsOnly(!isCloseFriendsOnly)}
              className={`w-10 h-5 rounded-full transition-colors p-0.5 relative ${
                isCloseFriendsOnly ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${isCloseFriendsOnly ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsAddStoryOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!mediaUrl}
              isLoading={createStoryMutation.isPending}
              onClick={() => createStoryMutation.mutate()}
              rightIcon={<Sparkles className="w-4 h-4" />}
            >
              Share Story (24h)
            </Button>
          </div>
        </div>
      </Modal>

      {/* Fullscreen Story Viewer Modal with Emoji Reactions */}
      {currentStory && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm h-[600px] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col justify-between">
            
            {/* Top Progress Segment Bar */}
            <div className="absolute top-3 left-3 right-3 z-20 flex gap-1.5">
              {activeStoryGroup?.stories.map((s, idx) => (
                <div
                  key={s.storyId}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    idx === activeStoryIndex ? 'bg-white shadow-glow-brand' : idx < activeStoryIndex ? 'bg-white/70' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Author Header */}
            <div className="absolute top-7 left-4 right-4 z-20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Avatar src={currentStory.author.profileImageUrl} name={currentStory.author.displayName} size="sm" />
                <div>
                  <p className="text-xs font-bold text-white shadow-sm">{currentStory.author.displayName}</p>
                  <p className="text-[10px] text-slate-300 flex items-center gap-1">
                    <Eye className="w-3 h-3 text-brand-400" /> 14 views • Active
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveStoryGroup(null)}
                className="p-1.5 text-white/80 hover:text-white bg-black/40 hover:bg-black/70 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Story Media Background */}
            <div className="relative w-full h-full">
              {(() => {
                const resolvedStoryUrl = currentStory.mediaUrl
                  ? currentStory.mediaUrl.startsWith('/uploads') && window.location.origin.includes('surge.sh')
                    ? `https://pick-sims-regions-plaza.trycloudflare.com${currentStory.mediaUrl}`
                    : currentStory.mediaUrl
                  : '';
                const isVideoStory = resolvedStoryUrl && (
                  resolvedStoryUrl.startsWith('data:video/') ||
                  resolvedStoryUrl.includes('/uploads/videos/') ||
                  /\.(mp4|webm|mov|mkv|avi)$/i.test(resolvedStoryUrl)
                );

                return isVideoStory ? (
                  <video
                    src={resolvedStoryUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={resolvedStoryUrl}
                    alt="Story media"
                    className="w-full h-full object-cover"
                  />
                );
              })()}

              {/* Navigation Left/Right Overlay Hotspots */}
              <div className="absolute inset-0 flex justify-between">
                <button
                  onClick={handlePrevStory}
                  className="w-1/3 h-full focus:outline-none flex items-center justify-start pl-2 text-white/40 hover:text-white"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onClick={handleNextStory}
                  className="w-1/3 h-full focus:outline-none flex items-center justify-end pr-2 text-white/40 hover:text-white"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </div>

              {/* Caption & Emoji Quick Reactions Bar */}
              <div className="absolute bottom-4 left-4 right-4 space-y-2 z-30">
                {currentStory.caption && (
                  <div className="p-3 bg-black/60 backdrop-blur-md rounded-2xl text-xs text-white font-medium border border-white/10 shadow-lg text-center">
                    {currentStory.caption}
                  </div>
                )}

                {/* Quick Reactions */}
                <div className="flex items-center justify-around p-2 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10">
                  {['❤️', '🔥', '👏', '😂', '😍'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setReactedEmoji(emoji)}
                      className="text-lg hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {reactedEmoji && (
                  <p className="text-[10px] text-center text-emerald-300 font-semibold bg-black/70 py-1 rounded-full border border-emerald-500/30">
                    Reacted {reactedEmoji} to {currentStory.author.displayName}'s story!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
