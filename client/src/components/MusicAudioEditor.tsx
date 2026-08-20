import React, { useState, useEffect } from 'react';

export interface LicensedTrack {
  trackId: string;
  title: string;
  artistName: string;
  durationSeconds?: number;
  audioUrl: string;
  coverArtUrl?: string;
  license: {
    code: string;
    name: string;
    allowDerivatives: boolean;
    allowCommercial: boolean;
    attributionRequired: boolean;
  };
}

export interface AudioTrimConfig {
  track: LicensedTrack;
  startTimeSeconds: number;
  durationSeconds: number;
  volumeMix: number; // 0 to 100
}

export interface MusicAudioEditorProps {
  onAudioSelected?: (config: AudioTrimConfig) => void;
}

export const MusicAudioEditor: React.FC<MusicAudioEditorProps> = ({ onAudioSelected }) => {
  const [catalog, setCatalog] = useState<LicensedTrack[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<LicensedTrack | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [volumeMix, setVolumeMix] = useState<number>(80);

  useEffect(() => {
    async function fetchCatalog() {
      try {
        const res = await fetch(`/api/music/catalog?q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        if (json.data) {
          setCatalog(json.data);
        }
      } catch (err) {
        console.warn('Failed to fetch music catalog:', err);
      }
    }
    fetchCatalog();
  }, [searchQuery]);

  const handleSelectTrack = (track: LicensedTrack) => {
    setSelectedTrack(track);
    setStartTime(0);
  };

  const handleApplyAudio = () => {
    if (!selectedTrack || !onAudioSelected) return;
    onAudioSelected({
      track: selectedTrack,
      startTimeSeconds: startTime,
      durationSeconds: 15,
      volumeMix
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900 border border-slate-800 rounded-xl text-white">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-wide uppercase text-slate-300">
          🎵 Licensed Music & Audio Editor
        </h3>
        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
          CC Licensed & Compliant
        </span>
      </div>

      {/* Search Input */}
      <input
        type="text"
        placeholder="Search Creative Commons tracks..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-purple-500"
      />

      {/* Track List */}
      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
        {catalog.map((track) => (
          <div
            key={track.trackId}
            onClick={() => handleSelectTrack(track)}
            className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
              selectedTrack?.trackId === track.trackId
                ? 'bg-purple-950/60 border-purple-500/80 shadow-md'
                : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              {track.coverArtUrl && (
                <img src={track.coverArtUrl} alt={track.title} className="w-9 h-9 rounded object-cover" />
              )}
              <div>
                <p className="text-xs font-semibold text-slate-100">{track.title}</p>
                <p className="text-[11px] text-slate-400">{track.artistName}</p>
              </div>
            </div>
            <span className="text-[10px] font-mono bg-slate-700/80 px-2 py-0.5 rounded text-purple-300">
              {track.license.code}
            </span>
          </div>
        ))}
      </div>

      {/* Selected Track Editor Controls */}
      {selectedTrack && (
        <div className="flex flex-col gap-3 p-3 bg-slate-950/80 rounded-lg border border-purple-500/30 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-300">Trimming: {selectedTrack.title}</span>
            <span className="text-[10px] text-slate-400">15s Story/Reel Segment</span>
          </div>

          {/* Start Time Offset Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Start Offset</span>
              <span>{startTime}s</span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0, (selectedTrack.durationSeconds || 180) - 15)}
              value={startTime}
              onChange={(e) => setStartTime(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          {/* Volume Mix Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Volume Level</span>
              <span>{volumeMix}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={volumeMix}
              onChange={(e) => setVolumeMix(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          <button
            onClick={handleApplyAudio}
            className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all mt-1"
          >
            Attach Audio to Story / Reel
          </button>
        </div>
      )}
    </div>
  );
};
