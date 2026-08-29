import React from 'react';
import { X, CornerUpLeft } from 'lucide-react';
import type { Message } from '../../types/index.js';
import type { GroupMessage } from '../../api/groups.api.js';

interface ReplyPreviewProps {
  /** The message being replied to */
  message: (Message & { sender?: { username?: string; displayName?: string } }) |
           (GroupMessage & { sender?: { username?: string; displayName?: string } }) |
           null;
  onCancel: () => void;
}

/**
 * Compact strip shown above the composer when the user taps "Reply".
 * Displays the target sender's username and a truncated preview of their message.
 */
export const ReplyPreview: React.FC<ReplyPreviewProps> = ({ message, onCancel }) => {
  if (!message) return null;

  const senderName =
    (message as any).sender?.displayName ||
    (message as any).sender?.username ||
    'Someone';

  const isUnsent = (message as any).isUnsent;
  const previewText = isUnsent
    ? 'This message was unsent'
    : ((message as any).content || '').slice(0, 120);

  return (
    <div
      className="
        flex items-center gap-2 px-3 py-2
        bg-slate-800/70 border-t border-slate-700/50
        border-l-4 border-l-brand-500
        animate-in slide-in-from-bottom-2 duration-150
      "
      role="note"
      aria-label={`Replying to ${senderName}`}
    >
      <CornerUpLeft className="w-4 h-4 text-brand-400 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-brand-300 truncate">
          Replying to @{senderName}
        </p>
        <p className="text-xs text-slate-400 truncate">{previewText}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="
          p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/60
          transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
          shrink-0
        "
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
