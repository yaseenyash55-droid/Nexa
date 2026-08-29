import React, { useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'] as const;

// Extended set shown when "+" is pressed
export const ALL_REACTIONS = [
  '❤️', '😂', '😮', '😢', '😡', '👍',
  '🔥', '🎉', '👀', '😍', '🤩', '💯',
  '✨', '🙌', '😭', '🥺', '💀', '🫶',
] as const;

interface ReactionPickerProps {
  /** Current reaction the viewer has placed, if any */
  currentReaction?: string | null;
  onReact: (emoji: string) => void;
  onRemove: () => void;
  /** If true, shows the full extended grid instead of just quick row */
  extended?: boolean;
  onToggleExtended?: () => void;
  className?: string;
}

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  currentReaction,
  onReact,
  onRemove,
  extended = false,
  onToggleExtended,
  className = '',
}) => {
  const reactions = extended ? ALL_REACTIONS : QUICK_REACTIONS;

  const handleClick = (emoji: string) => {
    if (currentReaction === emoji) {
      onRemove();
    } else {
      onReact(emoji);
    }
  };

  return (
    <div
      className={`flex items-center gap-1 p-1.5 ${className}`}
      role="group"
      aria-label="Quick reactions"
    >
      {reactions.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleClick(emoji)}
          aria-label={`React with ${emoji}`}
          aria-pressed={currentReaction === emoji}
          className={`
            text-xl w-9 h-9 flex items-center justify-center rounded-full
            transition-all duration-150 hover:scale-125 active:scale-110 focus:outline-none
            focus-visible:ring-2 focus-visible:ring-brand-500
            ${currentReaction === emoji
              ? 'bg-brand-500/30 ring-2 ring-brand-500/60 scale-110'
              : 'hover:bg-white/10'}
          `}
        >
          {emoji}
        </button>
      ))}

      {/* "+" button to toggle extended picker */}
      {!extended && onToggleExtended && (
        <button
          type="button"
          onClick={onToggleExtended}
          aria-label="More reactions"
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400
                     hover:bg-white/10 hover:text-white transition-all focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
