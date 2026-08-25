import React, { useEffect, useRef } from 'react';

export type CallState = 'INVITING' | 'RINGING' | 'CONNECTING' | 'CONNECTED' | 'ENDED' | 'ERROR';

export interface CallComponentProps {
  callState: CallState | string;
  callerName?: string;
  callerAvatarUrl?: string;
  ringtoneSrc?: string;
  className?: string;
}

export const CallComponent: React.FC<CallComponentProps> = ({
  callState,
  callerName = 'Caller',
  callerAvatarUrl = '/dr_doom_orb_logo.svg',
  ringtoneSrc = '/sounds/ringtone.mp3',
  className = ''
}) => {
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!ringtoneRef.current) {
      try {
        ringtoneRef.current = new Audio(ringtoneSrc);
      } catch (err) {
        console.warn('Audio initialization error:', err);
      }
    }

    const ringtone = ringtoneRef.current;
    if (!ringtone) return;

    ringtone.loop = true;

    const normalizedState = String(callState).toUpperCase();
    if (normalizedState === 'INVITING' || normalizedState === 'RINGING' || normalizedState === 'INCOMING') {
      ringtone.play().catch((e) => console.warn('Audio autoplay blocked by browser policy:', e));
    } else {
      ringtone.pause();
      ringtone.currentTime = 0;
    }

    return () => {
      ringtone.pause();
      ringtone.currentTime = 0;
    };
  }, [callState, ringtoneSrc]);

  const isRinging = ['INVITING', 'RINGING', 'INCOMING'].includes(String(callState).toUpperCase());

  return (
    <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
      <div className="avatar-container relative inline-block">
        <img
          src={callerAvatarUrl}
          alt={callerName}
          className="avatar-img w-28 h-28 rounded-full object-cover border-4 border-slate-800 shadow-2xl relative z-10"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/dr_doom_orb_logo.svg';
          }}
        />
        {isRinging && <div className="avatar-pulse" />}
      </div>
      <h3 className="mt-4 text-xl font-bold text-white tracking-wide">{callerName}</h3>
      <p className="text-sm text-slate-400 mt-1 capitalize">
        {callState === 'INVITING' ? 'Calling…' : callState === 'RINGING' ? 'Ringing…' : callState}
      </p>
    </div>
  );
};

export default CallComponent;
