import React, { useState, useEffect } from 'react';
import { Search, Music, Play, Pause, Loader2, X, AlertCircle } from 'lucide-react';
import { searchJamendoTracks } from '../../api/music.api.js';
import { NexaMusicTrack } from '../../types/music.types.js';

interface MusicPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (track: NexaMusicTrack) => void;
}

const GENRES = ['All', 'Pop', 'Electronic', 'Rock', 'Hip-Hop', 'Chillout', 'Acoustic', 'Jazz', 'Cinematic', 'Ambient'];

export const MusicPickerModal: React.FC<MusicPickerModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [tracks, setTracks] = useState<NexaMusicTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Audio preview state
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (audioElement) {
        audioElement.pause();
        setAudioElement(null);
        setPlayingTrackId(null);
      }
      return;
    }

    let isCancelled = false;

    async function fetchTracks() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await searchJamendoTracks(searchQuery.trim(), selectedGenre === 'All' ? undefined : selectedGenre.toLowerCase());
        if (!isCancelled) {
          setTracks(result);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.response?.data?.error?.message || err.message || 'Could not connect to the music service.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    const timer = setTimeout(fetchTracks, searchQuery ? 400 : 0);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedGenre, isOpen]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioElement]);

  const togglePreview = (track: NexaMusicTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (playingTrackId === track.id) {
      if (audioElement) {
        audioElement.pause();
        setPlayingTrackId(null);
      }
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    const newAudio = new Audio(track.audioUrl);
    newAudio.volume = 0.5;
    newAudio.onended = () => setPlayingTrackId(null);
    newAudio.play().catch(e => console.error('Audio play error:', e));
    
    setAudioElement(newAudio);
    setPlayingTrackId(track.id);
  };

  const handleSelect = (track: NexaMusicTrack) => {
    if (audioElement) {
      audioElement.pause();
      setPlayingTrackId(null);
    }
    onSelect(track);
  };

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white">
            <Music className="w-5 h-5 text-brand-400" />
            <h2 className="font-semibold text-base">Select Music</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 space-y-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tracks, artists..."
              className="w-full bg-slate-800/50 border border-slate-700 focus:border-brand-500 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {GENRES.map((genre) => {
              const isSelected = selectedGenre === genre && !searchQuery.trim();
              return (
                <button
                  key={genre}
                  onClick={() => {
                    setSelectedGenre(genre);
                    setSearchQuery('');
                  }}
                  className={`px-3 py-1 text-[11px] font-medium rounded-lg transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-[300px] p-2">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-500/80" />
              <p className="text-sm font-medium text-rose-300">{error}</p>
              <button onClick={() => setSearchQuery(searchQuery)} className="text-xs text-brand-400 hover:underline">Retry</button>
            </div>
          ) : isLoading && tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-3">
              <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
              <p className="text-xs text-slate-400">Loading catalog...</p>
            </div>
          ) : tracks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-2 p-6 text-center">
              <Music className="w-8 h-8 text-slate-600" />
              <p className="text-sm font-medium text-white">No tracks found</p>
              <p className="text-xs text-slate-400">Try a different search term or genre.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {tracks.map((track) => {
                const isPlaying = playingTrackId === track.id;
                
                return (
                  <div
                    key={track.id}
                    onClick={() => handleSelect(track)}
                    className="flex items-center gap-3 p-2 hover:bg-slate-800/60 rounded-xl cursor-pointer group transition-colors"
                  >
                    <div 
                      className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-800"
                      onClick={(e) => togglePreview(track, e)}
                    >
                      {track.artworkUrl ? (
                        <img src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-brand-400 bg-brand-500/10">
                          <Music className="w-4 h-4" />
                        </div>
                      )}
                      <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{track.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{track.artist}</p>
                    </div>
                    
                    <div className="shrink-0 text-[11px] font-mono text-slate-500">
                      {formatDuration(track.duration)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer attribution */}
        <div className="p-3 border-t border-slate-800 text-center bg-slate-900/80 shrink-0">
          <p className="text-[10px] text-slate-500">
            Powered by Jamendo Music • CC Licensed
          </p>
        </div>
      </div>
    </div>
  );
};
