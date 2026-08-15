import React, { useState, useEffect, useRef } from 'react';
import { User } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX, Sparkles } from 'lucide-react';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User;
  callType: 'audio' | 'video';
}

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  callType
}) => {
  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Timer effect for connected call
  useEffect(() => {
    let timer: any;
    if (callState === 'connected') {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callState]);

  // Media stream initialization
  useEffect(() => {
    if (!isOpen) return;

    setCallState('connecting');
    setCallDuration(0);

    let isSubscribed = true;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video'
        });
        if (!isSubscribed) return;

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setTimeout(() => {
          if (isSubscribed) {
            setCallState('connected');
          }
        }, 1500);
      } catch (err) {
        console.warn('Camera/Microphone access simulated or restricted:', err);
        setTimeout(() => {
          if (isSubscribed) {
            setCallState('connected');
          }
        }, 1200);
      }
    }

    void initMedia();

    return () => {
      isSubscribed = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, callType]);

  if (!isOpen) return null;

  const toggleMic = () => {
    setIsMuted(!isMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    }
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = isVideoOff));
    }
  };

  const handleEndCall = () => {
    setCallState('ended');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between min-h-[500px]">
        
        {/* Top Call Info Bar */}
        <div className="p-4 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-brand-600/30 border border-brand-500/40 rounded-lg text-brand-300">
              {callType === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            </span>
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">
                Nexa {callType === 'video' ? 'Video' : 'Audio'} Call
              </p>
              <p className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {callState === 'connecting' ? 'Calling...' : callState === 'connected' ? formatDuration(callDuration) : 'Call Ended'}
              </p>
            </div>
          </div>

          <div className="px-3 py-1 bg-slate-800/80 rounded-full border border-slate-700 text-[10px] font-semibold text-slate-300 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-brand-400" />
            <span>HD Voice & Video</span>
          </div>
        </div>

        {/* Center Call View Canvas */}
        <div className="relative flex-1 flex flex-col items-center justify-center p-6 text-center">
          {callType === 'video' ? (
            <div className="relative w-full h-[360px] bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {/* Simulated Remote User Video View */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-black">
                <Avatar src={targetUser.profileImageUrl} name={targetUser.displayName} size="lg" />
                <h3 className="mt-3 text-base font-bold text-white">{targetUser.displayName}</h3>
                <p className="text-xs text-slate-400">@{targetUser.username}</p>
                {callState === 'connecting' && (
                  <p className="mt-2 text-xs text-brand-400 font-semibold animate-pulse">Ringing video feed...</p>
                )}
              </div>

              {/* PIP Local Camera Self-View */}
              <div className="absolute bottom-3 right-3 w-28 h-40 bg-slate-900 rounded-xl overflow-hidden border-2 border-brand-500/60 shadow-xl z-20">
                {!isVideoOff ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-500 text-[10px]">
                    <VideoOff className="w-6 h-6 mb-1" />
                    <span>Cam Off</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Audio Call Pulsing Wave View */
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                {callState === 'connecting' && (
                  <div className="absolute -inset-4 rounded-full bg-brand-500/20 animate-ping" />
                )}
                <div className="relative p-1 rounded-full bg-gradient-to-tr from-brand-600 via-aurora-pink to-aurora-cyan shadow-glow-brand">
                  <Avatar src={targetUser.profileImageUrl} name={targetUser.displayName} size="lg" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-white">{targetUser.displayName}</h3>
                <p className="text-xs text-slate-400 mt-1">@{targetUser.username}</p>
                <p className="text-xs font-semibold text-brand-400 mt-2">
                  {callState === 'connecting' ? 'Connecting audio pipeline...' : 'Voice Connected'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Call Control Action Bar */}
        <div className="p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-6 z-20">
          {/* Mute Microphone */}
          <button
            onClick={toggleMic}
            className={`p-4 rounded-full transition-all border shadow-lg ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-slate-800/80 text-white border-slate-700 hover:bg-slate-700'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Toggle Video (if video call) */}
          {callType === 'video' && (
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition-all border shadow-lg ${
                isVideoOff
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-slate-800/80 text-white border-slate-700 hover:bg-slate-700'
              }`}
              title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
            </button>
          )}

          {/* Toggle Speaker */}
          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`p-4 rounded-full transition-all border shadow-lg ${
              !isSpeakerOn
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-slate-800/80 text-white border-slate-700 hover:bg-slate-700'
            }`}
            title={isSpeakerOn ? 'Speaker On' : 'Speaker Off'}
          >
            {!isSpeakerOn ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            className="p-4 bg-rose-600 hover:bg-rose-500 text-white rounded-full transition-all shadow-glow-brand scale-110 active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>

      </div>
    </div>
  );
};
