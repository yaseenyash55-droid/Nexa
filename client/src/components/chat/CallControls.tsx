import React, { useState, useRef } from 'react';
import { Mic, MicOff, MonitorUp, MonitorOff, Sparkles, PhoneOff } from 'lucide-react';
import { toggleScreenShare } from '../../utils/screenShare.js';
import { toggleBlur } from '../../utils/backgroundBlur.js';

export interface CallControlsProps {
  peerConnection: RTCPeerConnection | null;
  localStream: MediaStream | null;
  remoteStream?: MediaStream | null;
  onEndCall: () => void;
  className?: string;
}

export const CallControls: React.FC<CallControlsProps> = ({
  peerConnection,
  localStream,
  onEndCall,
  className = ''
}) => {
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isBlurActive, setIsBlurActive] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const blurCanvasRef = useRef<HTMLCanvasElement>(null);

  // 1. Handle Screen Sharing Toggle
  const handleToggleScreenShare = async () => {
    if (!peerConnection || !localStream) return;
    try {
      const active = await toggleScreenShare(peerConnection, localStream);
      setIsSharingScreen(active);
    } catch (err) {
      console.error('Screen sharing error:', err);
    }
  };

  // 2. Handle Background Blur Toggle
  const handleToggleBlur = async () => {
    if (!peerConnection || !localVideoRef.current || !blurCanvasRef.current) return;
    const nextState = !isBlurActive;
    await toggleBlur(peerConnection, localVideoRef.current, blurCanvasRef.current, nextState);
    setIsBlurActive(nextState);
  };

  // 3. Handle Audio Mute
  const handleToggleAudio = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  };

  return (
    <div className={`call-container flex flex-col items-center gap-4 ${className}`}>
      {/* Hidden processing elements for canvas blur pipeline */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />
      <canvas ref={blurCanvasRef} className="hidden" />

      {/* Control Action Bar */}
      <div className="call-controls-bar flex items-center justify-center gap-3 p-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-full shadow-2xl">
        {/* Mute Microphone */}
        <button
          type="button"
          onClick={handleToggleAudio}
          disabled={!localStream}
          className={`p-3 rounded-full transition-all flex items-center justify-center ${
            isAudioMuted
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg'
              : 'bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40'
          }`}
          aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
          title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Screen Share */}
        <button
          type="button"
          onClick={handleToggleScreenShare}
          disabled={!peerConnection || !localStream}
          className={`p-3 rounded-full transition-all flex items-center justify-center ${
            isSharingScreen
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white ring-2 ring-indigo-400 shadow-lg'
              : 'bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40'
          }`}
          aria-label={isSharingScreen ? 'Stop sharing screen' : 'Share screen'}
          title={isSharingScreen ? 'Stop sharing screen' : 'Share screen'}
        >
          {isSharingScreen ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
        </button>

        {/* Background Blur */}
        <button
          type="button"
          onClick={handleToggleBlur}
          disabled={!peerConnection || isSharingScreen}
          className={`p-3 rounded-full transition-all flex items-center justify-center ${
            isBlurActive
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white ring-2 ring-cyan-400 shadow-lg'
              : 'bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-40'
          }`}
          aria-label={isBlurActive ? 'Disable background blur' : 'Blur background'}
          title={isBlurActive ? 'Disable background blur' : 'Blur background'}
        >
          <Sparkles className="w-5 h-5" />
        </button>

        {/* End Call */}
        <button
          type="button"
          onClick={onEndCall}
          className="p-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg flex items-center justify-center"
          aria-label="End call"
          title="End call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default CallControls;
