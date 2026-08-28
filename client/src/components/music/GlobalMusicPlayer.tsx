import React from 'react';
import { useMusic } from '../../contexts/MusicContext.js';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Music, ExternalLink } from 'lucide-react';

export const GlobalMusicPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    togglePlay,
    seekTo,
    setVolume,
    toggleMute,
    playNext,
    playPrevious
  } = useMusic();

  if (!currentTrack) return null;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const coverImage = currentTrack.artworkUrl || '';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800/90 backdrop-blur-xl px-4 py-2.5 shadow-2xl transition-all animate-slideUp">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Track Info */}
        <div className="flex items-center gap-3 w-full md:w-1/4 min-w-0">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0">
            {coverImage ? (
              <img src={currentTrack.artworkUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-brand-400 bg-brand-500/10">
                <Music className="w-6 h-6" />
              </div>
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-0.5">
                <span className="w-1 h-3 bg-brand-400 rounded-full animate-pulse" />
                <span className="w-1 h-5 bg-brand-400 rounded-full animate-pulse delay-75" />
                <span className="w-1 h-2 bg-brand-400 rounded-full animate-pulse delay-150" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-white text-sm font-bold truncate" title={currentTrack.title}>{currentTrack.title}</h4>
            <p className="text-[11px] text-slate-400 truncate">
              {currentTrack.artist}
            </p>
          </div>
        </div>

        {/* Playback Controls & Timeline Slider */}
        <div className="flex flex-col items-center gap-1.5 w-full md:w-2/4">
          <div className="flex items-center gap-3">
            <button
              onClick={playPrevious}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
              title="Previous Track"
              aria-label="Previous Track"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlay}
              className="p-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-full transition-all shadow-glow-brand hover:scale-105 active:scale-95"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>
            <button
              onClick={playNext}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
              title="Next Track"
              aria-label="Next Track"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Seek Bar */}
          <div className="flex items-center gap-2.5 w-full max-w-lg">
            <span className="text-[10px] text-slate-400 font-mono w-8 text-right shrink-0">
              {formatTime(currentTime)}
            </span>
            <div className="relative flex-1 flex items-center group cursor-pointer">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500 focus:outline-none"
              />
            </div>
            <span className="text-[10px] text-slate-400 font-mono w-8 shrink-0">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Volume & Jamendo Attribution */}
        <div className="flex items-center justify-end gap-3 w-full md:w-1/4">
          <div className="hidden lg:flex items-center gap-2">
            <button onClick={toggleMute} className="text-slate-400 hover:text-white transition-colors">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-16 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
          </div>

          <a
            href={currentTrack.shareUrl || 'https://www.jamendo.com'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-brand-300 bg-slate-900 border border-slate-800 hover:border-brand-500/40 rounded-lg px-2.5 py-1 transition-all"
            title="Music provided via Jamendo under Creative Commons"
          >
            <span>Music via Jamendo</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
