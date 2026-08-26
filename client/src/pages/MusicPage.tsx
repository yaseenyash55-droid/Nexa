import React, { useState, useEffect } from 'react';
import { AppShell } from '../components/layout/AppShell.js';
import { useMusic } from '../contexts/MusicContext.js';
import { JamendoTrack, JamendoApiResponse } from '../types/music.types.js';
import { Search, Play, Pause, Music, Sparkles, ExternalLink, Disc, Loader2, Volume2, AlertCircle } from 'lucide-react';

const GENRES = ['All', 'Pop', 'Electronic', 'Rock', 'Hip-Hop', 'Chillout', 'Acoustic', 'Jazz', 'Cinematic', 'Ambient'];
const DEFAULT_JAMENDO_CLIENT_ID = 'c031c261';

export const MusicPage: React.FC = () => {
  const { currentTrack, isPlaying, playTrack, togglePlay } = useMusic();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [tracks, setTracks] = useState<JamendoTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function fetchJamendoTracks() {
      setIsLoading(true);
      setError(null);

      try {
        const clientId = (import.meta as any).env?.VITE_JAMENDO_CLIENT_ID || DEFAULT_JAMENDO_CLIENT_ID;
        let url = `https://api.jamendo.com/v3.0/tracks/?client_id=${clientId}&format=jsonpretty&limit=25&include=musicinfo&audioformat=mp32`;

        if (searchQuery.trim()) {
          url += `&search=${encodeURIComponent(searchQuery.trim())}`;
        } else if (selectedGenre !== 'All') {
          url += `&tags=${encodeURIComponent(selectedGenre.toLowerCase())}&boost=popularity_month`;
        } else {
          url += `&boost=popularity_month`;
        }

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Jamendo API returned status ${res.status}`);
        }

        const data: JamendoApiResponse = await res.json();

        if (!isCancelled) {
          if (data.results && data.results.length > 0) {
            setTracks(data.results);
          } else {
            setTracks([]);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('Jamendo tracks fetch error:', err);
          setError('Could not connect to Jamendo catalog. Check your internet connection or API client ID.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    const timer = setTimeout(fetchJamendoTracks, searchQuery ? 350 : 0);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedGenre]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 pb-28">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-2xl text-white shadow-glow-brand">
                <Music className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white tracking-tight">Music Lounge</h1>
                <p className="text-xs text-slate-400">Discover and stream thousands of free, royalty-free tracks</p>
              </div>
            </div>
          </div>

          <a
            href="https://www.jamendo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 self-start md:self-auto text-xs text-slate-300 hover:text-white bg-slate-900/90 border border-slate-800 hover:border-brand-500/40 px-3.5 py-2 rounded-xl transition-all shadow-sm"
          >
            <Disc className="w-4 h-4 text-brand-400" />
            <span>Music via Jamendo</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
          </a>
        </div>

        {/* Search & Filter Section */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tracks, artists, or keywords (e.g. synthwave, acoustic, lo-fi)..."
              className="w-full bg-slate-900/90 border border-slate-800 focus:border-brand-500 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
            />
            {isLoading && (
              <Loader2 className="w-5 h-5 absolute right-4 top-3.5 text-brand-400 animate-spin" />
            )}
          </div>

          {/* Genre Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {GENRES.map((genre) => {
              const isSelected = selectedGenre === genre && !searchQuery.trim();
              return (
                <button
                  key={genre}
                  onClick={() => {
                    setSelectedGenre(genre);
                    setSearchQuery('');
                  }}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-brand-600 text-white shadow-glow-brand'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Tracks List */}
        <div className="space-y-2">
          {isLoading && tracks.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-brand-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Searching Jamendo music catalog...</p>
            </div>
          ) : tracks.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/30 border border-slate-800/60 rounded-3xl space-y-2">
              <Disc className="w-10 h-10 text-slate-600 mx-auto animate-spin" style={{ animationDuration: '6s' }} />
              <p className="text-sm font-bold text-white">No tracks found</p>
              <p className="text-xs text-slate-400">Try searching for a different keyword, artist, or genre tag.</p>
            </div>
          ) : (
            <div className="bg-slate-900/40 border border-slate-800/70 rounded-3xl overflow-hidden divide-y divide-slate-800/40 shadow-xl">
              {tracks.map((track, idx) => {
                const isThisPlaying = currentTrack?.id === track.id && isPlaying;
                const isThisCurrent = currentTrack?.id === track.id;
                const cover = track.image || track.album_image || '';

                return (
                  <div
                    key={track.id}
                    onClick={() => {
                      if (isThisCurrent) togglePlay();
                      else playTrack(track, tracks);
                    }}
                    className={`flex items-center justify-between p-3.5 hover:bg-slate-800/50 transition-all cursor-pointer group ${
                      isThisCurrent ? 'bg-brand-600/10 border-l-4 border-brand-500' : ''
                    }`}
                  >
                    {/* Left: Index/Play + Cover + Title */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {/* Play/Index Button */}
                      <div className="w-8 h-8 flex items-center justify-center shrink-0">
                        {isThisPlaying ? (
                          <div className="flex items-center gap-0.5">
                            <span className="w-1 h-3 bg-brand-400 rounded-full animate-pulse" />
                            <span className="w-1 h-5 bg-brand-400 rounded-full animate-pulse delay-75" />
                            <span className="w-1 h-2 bg-brand-400 rounded-full animate-pulse delay-150" />
                          </div>
                        ) : (
                          <span className="text-xs font-mono text-slate-500 group-hover:hidden">
                            {idx + 1}
                          </span>
                        )}
                        <button
                          className={`p-2 rounded-full text-white bg-brand-600 shadow-glow-brand ${
                            isThisPlaying ? 'flex' : 'hidden group-hover:flex'
                          }`}
                        >
                          {isThisPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                        </button>
                      </div>

                      {/* Cover Art */}
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0">
                        {cover ? (
                          <img src={cover} alt={track.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-brand-400 bg-brand-500/10">
                            <Music className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      {/* Track Details */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate ${isThisCurrent ? 'text-brand-300' : 'text-white'}`}>
                          {track.name}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {track.artist_name} {track.album_name ? `• ${track.album_name}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Right: Duration & Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono text-slate-400">
                        {formatDuration(track.duration)}
                      </span>

                      {track.shareurl && (
                        <a
                          href={track.shareurl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-slate-500 hover:text-brand-300 transition-colors"
                          title="View on Jamendo"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Jamendo Attribution Footer */}
        <div className="p-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl text-center space-y-1">
          <p className="text-xs font-semibold text-slate-300">
            Powered by <a href="https://www.jamendo.com" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">Jamendo Music</a>
          </p>
          <p className="text-[11px] text-slate-500">
            All music is provided through the Jamendo API under Creative Commons licenses. Free for personal streaming and enjoyment.
          </p>
        </div>
      </div>
    </AppShell>
  );
};
