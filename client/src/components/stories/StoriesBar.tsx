import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { socialApi } from '../../api/social.api.js';
import { mediaApi } from '../../api/media.api.js';
import { api } from '../../api/client.js';
import { Story } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';
import { Plus, X, Upload, Sparkles, ChevronLeft, ChevronRight, Eye, Users, Loader2, Music, Volume2, VolumeX, Search } from 'lucide-react';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { getMediaUrl, handleImageError } from '../../utils/media.js';
import { StoryEditor } from './StoryEditor.js';

const StoryMusicOverlay: React.FC<{ musicTrackId: string }> = ({ musicTrackId }) => {
  const [track, setTrack] = useState<any | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    async function fetchTrack() {
      try {
        const res = await api.get(`/music/spotify/track/${musicTrackId}`);
        setTrack(res.data.data);
      } catch (err) {
        console.error('Failed to load track details:', err);
      }
    }
    fetchTrack();
  }, [musicTrackId]);

  useEffect(() => {
    if (!track?.preview_url) return;

    const audio = new Audio(track.preview_url);
    audio.loop = true;
    audio.muted = isMuted;
    audioRef.current = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Audio autoplay prevented:', err);
      });
    }

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [track]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  if (!track) return null;

  return (
    <div className="absolute top-20 left-4 right-4 z-40 flex items-center justify-between p-2.5 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg pointer-events-auto">
      <div className="flex items-center gap-2.5 min-w-0">
        {track.album.images?.[0]?.url ? (
          <img src={track.album.images[0].url} alt="Album Art" className="w-9 h-9 rounded-xl object-cover border border-white/10 shrink-0" />
        ) : (
          <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center shrink-0">
            <Music className="w-4 h-4 text-brand-400" />
          </div>
        )}
        <div className="text-left min-w-0">
          <p className="text-[11px] font-bold text-white truncate">{track.name}</p>
          <p className="text-[9px] text-brand-300 truncate">{track.artists.map((a: any) => a.name).join(', ')}</p>
        </div>
      </div>
      {track.preview_url && (
        <button
          type="button"
          onClick={() => setIsMuted(!isMuted)}
          className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors shrink-0"
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
};

export const StoriesBar: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddStoryOpen, setIsAddStoryOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isCloseFriendsOnly, setIsCloseFriendsOnly] = useState(false);
  const [activeStoryGroup, setActiveStoryGroup] = useState<{ username: string; stories: Story[] } | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [reactedEmoji, setReactedEmoji] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const [selectedMusicTrack, setSelectedMusicTrack] = useState<any | null>(null);
  const [isMusicSearchOpen, setIsMusicSearchOpen] = useState(false);
  const [musicSearchQuery, setMusicSearchQuery] = useState('');
  const [musicSearchResults, setMusicSearchResults] = useState<any[]>([]);
  const [isSearchingMusic, setIsSearchingMusic] = useState(false);
  const [isEditingMedia, setIsEditingMedia] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: stories = [] } = useQuery({
    queryKey: ['stories'],
    queryFn: () => socialApi.getFeedStories(),
    refetchInterval: 30000
  });

  const handleMusicSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!musicSearchQuery.trim()) return;
    try {
      setIsSearchingMusic(true);
      const res = await api.get(`/music/spotify/search`, { params: { q: musicSearchQuery } });
      setMusicSearchResults(res.data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingMusic(false);
    }
  };

  const createStoryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('Please select an image or video file first');

      // 1. Upload media to backend storage
      const isVideo = selectedFile.type.startsWith('video/');
      const kind = isVideo ? 'reel' : 'story';
      const uploadedUrl = await mediaApi.uploadFile(selectedFile, kind as any, (progress) => {
        setUploadProgress(progress);
      });

      // 2. Create story record with permanent media URL
      return socialApi.createStory({
        mediaUrl: uploadedUrl,
        caption: caption.trim() || undefined,
        musicTrackId: selectedMusicTrack?.id || undefined
      });
    },
    onSuccess: () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
      setSelectedFile(null);
      setLocalPreviewUrl(null);
      setCaption('');
      setIsCloseFriendsOnly(false);
      setIsAddStoryOpen(false);
      setUploadProgress(0);
      setSelectedMusicTrack(null);
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to share Cosmic';
      alert('✖ Failed to share Cosmic: ' + msg);
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }

    setSelectedFile(file);
    setLocalPreviewUrl(URL.createObjectURL(file));
    if (file.type.startsWith('image/')) {
      setIsEditingMedia(true);
    }
  };

  const handleCloseAddModal = () => {
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
    }
    setSelectedFile(null);
    setLocalPreviewUrl(null);
    setCaption('');
    setIsAddStoryOpen(false);
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
      setActiveStoryIndex((prev) => prev + 1);
      setReactedEmoji(null);
    } else {
      setActiveStoryGroup(null);
    }
  };

  const handlePrevStory = () => {
    if (!activeStoryGroup) return;
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((prev) => prev - 1);
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
              <Avatar src={getMediaUrl(user.profileImageUrl)} name={user.displayName} size="lg" />
              <div className="absolute bottom-0 right-0 p-1 bg-brand-600 text-white rounded-full border-2 border-background shadow-lg">
                <Plus className="w-3 h-3" />
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-300 group-hover:text-white">Your Cosmic</span>
          </div>
        )}

        {/* Grouped Author Stories */}
        {Object.entries(groupedStories).map(([uname, group]) => (
          <div
            key={uname}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
            onClick={() => openStoryViewer(uname)}
          >
            <div className="p-0.5 rounded-full bg-gradient-to-tr from-brand-500 via-pink-500 to-cyan-400 group-hover:scale-105 transition-transform shadow-glow-brand">
              <div className="p-0.5 bg-background rounded-full">
                <Avatar src={getMediaUrl(group.author.profileImageUrl)} name={group.author.displayName} size="lg" />
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-300 group-hover:text-white truncate max-w-[70px]">
              {group.author.displayName}
            </span>
          </div>
        ))}
      </div>

      {/* Add Story Modal */}
      <Modal isOpen={isAddStoryOpen} onClose={handleCloseAddModal} title="Create 24h Cosmic">
        <div className="space-y-4">
          <p className="text-xs text-slate-400">Cosmic disappears automatically after 24 hours.</p>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {localPreviewUrl ? (
            <div className="relative rounded-2xl overflow-hidden max-h-72 border border-brand-500/50 bg-black flex items-center justify-center">
              {selectedFile?.type.startsWith('video/') ? (
                <video src={localPreviewUrl} controls autoPlay muted loop className="w-full max-h-72 object-contain" />
              ) : (
                <>
                  <img src={localPreviewUrl} alt="Cosmic preview" className="w-full max-h-72 object-contain" />
                  <button
                    type="button"
                    onClick={() => setIsEditingMedia(true)}
                    className="absolute bottom-2 left-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-550 text-white rounded-lg text-xs font-semibold shadow-md transition"
                  >
                    Edit Image
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
                  setSelectedFile(null);
                  setLocalPreviewUrl(null);
                }}
                className="absolute top-2 right-2 p-1.5 bg-slate-900/80 text-white rounded-full hover:bg-rose-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-44 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 hover:bg-slate-800/60 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <Upload className="w-8 h-8 text-brand-400" />
              <span className="text-xs font-semibold">Upload Photo or Video</span>
              <span className="text-[10px] text-slate-500">Supports JPEG, PNG, WebP, MP4</span>
            </button>
          )}

          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Add a Cosmic caption..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
          />

          {/* Spotify Music Sticker Picker */}
          <div className="space-y-2">
            {selectedMusicTrack ? (
              <div className="flex items-center justify-between p-3 bg-brand-500/10 border border-brand-500/30 rounded-xl text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {selectedMusicTrack.album.images?.[0]?.url && (
                    <img src={selectedMusicTrack.album.images[0].url} alt="Album Art" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="text-left min-w-0">
                    <p className="font-semibold text-white truncate">{selectedMusicTrack.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{selectedMusicTrack.artists.map((a: any) => a.name).join(', ')}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedMusicTrack(null)} className="text-rose-400 hover:text-rose-300 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsMusicSearchOpen(true)}
                className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition"
              >
                <Music className="w-4 h-4 text-brand-400" />
                <span>Attach Song from Spotify</span>
              </button>
            )}
          </div>

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
              <div
                className={`w-4 h-4 bg-white rounded-full transition-transform ${
                  isCloseFriendsOnly ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={handleCloseAddModal}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedFile || createStoryMutation.isPending}
              isLoading={createStoryMutation.isPending}
              onClick={() => createStoryMutation.mutate()}
              rightIcon={createStoryMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            >
              {createStoryMutation.isPending
                ? uploadProgress > 0 && uploadProgress < 100
                  ? `Uploading (${uploadProgress}%)...`
                  : 'Sharing Cosmic...'
                : 'Share Cosmic (24h)'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Fullscreen Story Viewer Modal */}
      {currentStory && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm h-[600px] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col justify-between">
            {/* Top Progress Segment Bar */}
            <div className="absolute top-3 left-3 right-3 z-20 flex gap-1.5">
              {activeStoryGroup?.stories.map((s, idx) => (
                <div
                  key={s.storyId}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    idx === activeStoryIndex
                      ? 'bg-white shadow-glow-brand'
                      : idx < activeStoryIndex
                      ? 'bg-white/70'
                      : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Author Header */}
            <div className="absolute top-7 left-4 right-4 z-20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Avatar
                  src={getMediaUrl(currentStory.author.profileImageUrl)}
                  name={currentStory.author.displayName}
                  size="sm"
                />
                <div>
                  <p className="text-xs font-bold text-white shadow-sm">{currentStory.author.displayName}</p>
                  <p className="text-[10px] text-slate-300 flex items-center gap-1">
                    <Eye className="w-3 h-3 text-brand-400" /> Active Cosmic
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveStoryGroup(null)}
                className="p-1.5 text-white/80 hover:text-white bg-black/40 hover:bg-black/70 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Story Media Background */}
            <div className="relative w-full h-full bg-black flex items-center justify-center">
              {currentStory.musicTrackId && (
                <StoryMusicOverlay musicTrackId={currentStory.musicTrackId} />
              )}
              {(() => {
                const resolvedStoryUrl = getMediaUrl(currentStory.mediaUrl) || '';
                const isVideoStory =
                  resolvedStoryUrl.startsWith('data:video/') ||
                  resolvedStoryUrl.includes('/uploads/videos/') ||
                  /\.(mp4|webm|mov|mkv|avi)$/i.test(resolvedStoryUrl);

                return isVideoStory ? (
                  <video
                    src={resolvedStoryUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={resolvedStoryUrl}
                    alt="Cosmic media"
                    onError={handleImageError}
                    className="w-full h-full object-contain"
                  />
                );
              })()}

              {/* Navigation Left/Right Overlay Hotspots */}
              <div className="absolute inset-0 flex justify-between pointer-events-auto">
                <button
                  type="button"
                  onClick={handlePrevStory}
                  className="w-1/3 h-full focus:outline-none flex items-center justify-start pl-2 text-white/40 hover:text-white transition"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  type="button"
                  onClick={handleNextStory}
                  className="w-1/3 h-full focus:outline-none flex items-center justify-end pr-2 text-white/40 hover:text-white transition"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </div>

              {/* Caption & Emoji Quick Reactions Bar */}
              <div className="absolute bottom-4 left-4 right-4 space-y-2 z-30 pointer-events-auto">
                {currentStory.caption && (
                  <div className="p-3 bg-black/60 backdrop-blur-md rounded-2xl text-xs text-white font-medium border border-white/10 shadow-lg text-center">
                    {currentStory.caption}
                  </div>
                )}

                {/* Quick Reactions */}
                <div className="flex items-center justify-around p-2 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10">
                  {['❤️', '🔥', '👏', '😂', '😍'].map((emoji) => (
                    <button
                      type="button"
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
                    Reacted {reactedEmoji} to {currentStory.author.displayName}&apos;s Cosmic!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spotify Music Search Modal */}
      <Modal isOpen={isMusicSearchOpen} onClose={() => setIsMusicSearchOpen(false)} title="Search Spotify Tracks">
        <div className="space-y-4 text-slate-100">
          <form onSubmit={handleMusicSearch} className="flex gap-2">
            <input
              type="text"
              value={musicSearchQuery}
              onChange={(e) => setMusicSearchQuery(e.target.value)}
              placeholder="Search by song name or artist..."
              className="flex-1 bg-slate-900 border border-slate-800 focus:border-brand-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <Button type="submit" size="sm" isLoading={isSearchingMusic} leftIcon={<Search className="w-3.5 h-3.5" />}>
              Search
            </Button>
          </form>

          {isSearchingMusic ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
            </div>
          ) : musicSearchResults.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">No tracks found. Search for a popular song or artist.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {musicSearchResults.map((track) => (
                <div
                  key={track.id}
                  onClick={() => {
                    setSelectedMusicTrack(track);
                    setIsMusicSearchOpen(false);
                    setMusicSearchQuery('');
                    setMusicSearchResults([]);
                  }}
                  className="flex items-center gap-3 p-2 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 rounded-xl cursor-pointer transition"
                >
                  {track.album.images?.[0]?.url ? (
                    <img src={track.album.images[0].url} alt="Cover Art" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
                      <Music className="w-4 h-4 text-slate-500" />
                    </div>
                  )}
                  <div className="text-left min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">{track.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{track.artists.map((a: any) => a.name).join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {isEditingMedia && selectedFile && (
        <StoryEditor
          file={selectedFile}
          onCancel={() => setIsEditingMedia(false)}
          onSave={(editedFile) => {
            setSelectedFile(editedFile);
            if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
            setLocalPreviewUrl(URL.createObjectURL(editedFile));
            setIsEditingMedia(false);
          }}
        />
      )}
    </div>
  );
};
