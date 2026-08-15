import React, { useState, useRef } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialApi } from '../api/social.api.js';
import { Reel } from '../types/index.js';
import { Avatar } from '../components/ui/Avatar.js';
import { Heart, MessageSquare, Share2, Plus, Sparkles, Upload, Volume2, VolumeX, X } from 'lucide-react';
import { Modal } from '../components/ui/Modal.js';
import { Button } from '../components/ui/Button.js';
import { useAuth } from '../contexts/AuthContext.js';
import { readMediaAsDataUrl } from '../utils/mediaUpload.js';

export const ReelsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddReelOpen, setIsAddReelOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [isMuted, setIsMuted] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: reels = [], isLoading } = useQuery({
    queryKey: ['reels'],
    queryFn: () => socialApi.getReels()
  });

  const createReelMutation = useMutation({
    mutationFn: async () => {
      if (!videoUrl) throw new Error('Choose a video clip first');
      return socialApi.createReel({ videoUrl, caption });
    },
    onSuccess: () => {
      setVideoUrl('');
      setVideoFile(null);
      setCaption('');
      setIsAddReelOpen(false);
      queryClient.invalidateQueries({ queryKey: ['reels'] });
      alert('✔ Reel published successfully!');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to publish reel';
      alert('✖ Failed to publish reel: ' + msg);
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await readMediaAsDataUrl(file);
      setVideoFile(file);
      setVideoUrl(dataUrl);
    } catch (err: any) {
      alert(err.message || 'Media file validation failed');
    }
  };

  return (
    <AppShell>
      <div className="p-4 space-y-6 max-w-xl mx-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-400" /> Nexa Reels & Short Media
            </h1>
            <p className="text-xs text-slate-400">Discover trending video reels and clips</p>
          </div>
          {user && (
            <Button
              size="sm"
              onClick={() => setIsAddReelOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Reel
            </Button>
          )}
        </div>

        {/* Reels Vertical Scroll Feed */}
        {isLoading ? (
          <div className="h-[600px] rounded-3xl bg-slate-900 animate-pulse flex items-center justify-center text-slate-500 text-sm">
            Loading video reels...
          </div>
        ) : reels.length === 0 ? (
          <div className="h-96 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <Sparkles className="w-10 h-10 text-brand-400" />
            <h3 className="text-base font-bold text-white">No Reels Posted Yet</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              Be the first in your network to record and share a video reel!
            </p>
            {user && (
              <Button size="sm" onClick={() => setIsAddReelOpen(true)}>
                Upload First Reel
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {reels.map((reel) => (
              <ReelCard key={reel.reelId} reel={reel} isMuted={isMuted} onToggleMute={() => setIsMuted(!isMuted)} />
            ))}
          </div>
        )}

        {/* Create Reel Modal */}
        <Modal isOpen={isAddReelOpen} onClose={() => setIsAddReelOpen(false)} title="Upload Nexa Reel">
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              accept="video/mp4,video/webm"
              className="hidden"
              onChange={handleFileUpload}
            />

            {videoUrl ? (
              <div className="relative rounded-2xl overflow-hidden max-h-72 border border-brand-500/50 bg-black">
                <video src={videoUrl} controls className="w-full h-full object-cover" />
                <button
                  onClick={() => { URL.revokeObjectURL(videoUrl); setVideoUrl(''); setVideoFile(null); }}
                  className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-full hover:bg-rose-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-48 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 hover:bg-slate-800/60 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <Upload className="w-8 h-8 text-brand-400" />
                <span className="text-xs font-semibold">Upload Local Video / Clip File</span>
              </button>
            )}

            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a reel caption..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsAddReelOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!videoUrl}
                isLoading={createReelMutation.isPending}
                onClick={() => createReelMutation.mutate()}
                rightIcon={<Sparkles className="w-4 h-4" />}
              >
                Publish Reel
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
};

const ReelCard: React.FC<{ reel: Reel; isMuted: boolean; onToggleMute: () => void }> = ({ reel, isMuted, onToggleMute }) => {
  const queryClient = useQueryClient();
  const [isLiked, setIsLiked] = useState(reel.isLiked || false);
  const [likesCount, setLikesCount] = useState(reel.likesCount || 0);

  const likeMutation = useMutation({
    mutationFn: () => (isLiked ? socialApi.unlikeReel(reel.reelId) : socialApi.likeReel(reel.reelId)),
    onMutate: () => {
      setIsLiked(!isLiked);
      setLikesCount(prev => (isLiked ? prev - 1 : prev + 1));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    }
  });

  const resolvedVideoUrl = reel.videoUrl.startsWith('/uploads') && window.location.origin.includes('surge.sh')
    ? `https://pick-sims-regions-plaza.trycloudflare.com${reel.videoUrl}`
    : reel.videoUrl;

  const isVideo = resolvedVideoUrl.startsWith('data:video/') ||
                  resolvedVideoUrl.includes('/uploads/videos/') ||
                  /\.(mp4|webm|mov|mkv|avi)$/i.test(resolvedVideoUrl);

  return (
    <div className="relative w-full h-[620px] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800/80 shadow-2xl flex flex-col justify-between group">
      {/* Video Media Render */}
      {isVideo ? (
        <video
          src={resolvedVideoUrl}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <img src={resolvedVideoUrl} alt="Reel media" className="w-full h-full object-cover" />
      )}

      {/* Top Controls Bar */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={onToggleMute}
          className="p-2 bg-black/50 backdrop-blur-md rounded-full text-white/80 hover:text-white"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Right Side Action Floating Bar */}
      <div className="absolute right-4 bottom-12 z-20 flex flex-col items-center gap-5">
        <button
          onClick={() => likeMutation.mutate()}
          className="flex flex-col items-center gap-1 text-white group"
        >
          <div className={`p-3 rounded-full backdrop-blur-md transition-transform group-hover:scale-110 ${
            isLiked ? 'bg-rose-600 text-white' : 'bg-black/50 text-white'
          }`}>
            <Heart className={`w-6 h-6 ${isLiked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-xs font-bold shadow-sm">{likesCount}</span>
        </button>

        <button className="flex flex-col items-center gap-1 text-white group">
          <div className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white group-hover:scale-110 transition-transform">
            <MessageSquare className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold shadow-sm">Reply</span>
        </button>

        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert('Reel link copied!');
          }}
          className="flex flex-col items-center gap-1 text-white group"
        >
          <div className="p-3 bg-black/50 backdrop-blur-md rounded-full text-white group-hover:scale-110 transition-transform">
            <Share2 className="w-6 h-6" />
          </div>
          <span className="text-xs font-bold shadow-sm">Share</span>
        </button>
      </div>

      {/* Bottom Author & Caption Info */}
      <div className="absolute bottom-4 left-4 right-16 z-20 space-y-2 p-3 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">
        <div className="flex items-center gap-2.5">
          <Avatar src={reel.author.profileImageUrl} name={reel.author.displayName} size="sm" />
          <div>
            <p className="text-xs font-bold text-white">{reel.author.displayName}</p>
            <p className="text-[10px] text-slate-300">@{reel.author.username}</p>
          </div>
        </div>
        {reel.caption && (
          <p className="text-xs text-white/90 leading-relaxed font-medium">{reel.caption}</p>
        )}
      </div>
    </div>
  );
};
