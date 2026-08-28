import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Music, ExternalLink } from 'lucide-react';
import { NexaMusicTrack } from '../../types/music.types.js';

interface MusicMessageCardProps {
  track: NexaMusicTrack;
}

export const MusicMessageCard: React.FC<MusicMessageCardProps> = ({ track }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) {
      const audio = new Audio(track.audioUrl);
      audio.volume = 0.5;
      audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      });
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setProgress(0);
      });
      audioRef.current = audio;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.error('Audio playback failed', e));
      setIsPlaying(true);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="w-[280px] sm:w-[320px] bg-slate-900/80 border border-slate-700 rounded-2xl overflow-hidden mt-1 select-none">
      <div className="flex p-3 gap-3">
        {/* Artwork + Play overlay */}
        <div 
          className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 cursor-pointer group bg-slate-800"
          onClick={togglePlay}
        >
          {track.artworkUrl ? (
            <img src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-brand-400 bg-brand-500/10">
              <Music className="w-6 h-6" />
            </div>
          )}
          
          <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white drop-shadow-md" />
            ) : (
              <Play className="w-6 h-6 text-white drop-shadow-md translate-x-[1px]" />
            )}
          </div>
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white truncate leading-tight">{track.title}</h4>
            <p className="text-xs text-slate-400 truncate">{track.artist}</p>
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-mono text-brand-400 font-medium">
              JAMENDO MUSIC
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              {formatDuration(track.duration)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 w-full bg-slate-800">
        <div 
          className="h-full bg-brand-500 transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Footer link */}
      {track.shareUrl && (
        <a 
          href={track.shareUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 p-2 bg-slate-800/50 hover:bg-slate-700/50 text-[10px] font-semibold text-slate-300 transition-colors border-t border-slate-700"
        >
          <span>VIEW ON JAMENDO</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
};
