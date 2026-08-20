import React from 'react';
import { User } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';
import { Phone, Video, X } from 'lucide-react';
import { Button } from '../ui/Button.js';

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
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center space-y-3 pt-2">
          <div className="relative p-1 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-400">
            <Avatar src={targetUser.profileImageUrl} name={targetUser.displayName} size="lg" />
          </div>
          <div>
            <h3 id="call-modal-title" className="text-base font-bold text-white">
              {targetUser.displayName}
            </h3>
            <p className="text-xs text-slate-400">@{targetUser.username}</p>
          </div>
        </div>

        <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2 text-xs text-slate-300 text-left">
          <div className="flex items-center gap-2 text-brand-300 font-semibold">
            {callType === 'video' ? <Video className="w-4 h-4 text-brand-400" /> : <Phone className="w-4 h-4 text-brand-400" />}
            <span>{callType === 'video' ? 'Video' : 'Voice'} Calling Unavailable</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Real-time peer-to-peer calling requires dedicated STUN/TURN signaling servers which are not enabled in this deployment. Please use Direct Messages for communication.
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={onClose} className="w-full">
            Understood
          </Button>
        </div>
      </div>
    </div>
  );
};
