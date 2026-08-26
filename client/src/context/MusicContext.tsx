// client/src/context/MusicContext.tsx

import React, { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { JamendoTrack } from '../api/music.api';

interface MusicContextProps {
  currentTrack: JamendoTrack | null;
  isPlaying: boolean;
  playTrack: (track: JamendoTrack) => void;
  pause: () => void;
  resume: () => void;
}

const MusicContext = createContext<MusicContextProps | undefined>(undefined);

export const MusicProvider = ({ children }: { children: ReactNode }) => {
  const [currentTrack, setCurrentTrack] = useState<JamendoTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(new Audio());

  const playTrack = (track: JamendoTrack) => {
    if (currentTrack?.audio !== track.audio) {
      audioRef.current.src = track.audio;
    }
    audioRef.current.play();
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const pause = () => {
    audioRef.current.pause();
    setIsPlaying(false);
  };

  const resume = () => {
    audioRef.current.play();
    setIsPlaying(true);
  };

  return (
    <MusicContext.Provider value={{ currentTrack, isPlaying, playTrack, pause, resume }}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = (): MusicContextProps => {
  const ctx = useContext(MusicContext);
  if (!ctx) {
    throw new Error('useMusic must be used within MusicProvider');
  }
  return ctx;
};
