import React from 'react';
import type { ReactionSummary } from '../../types/index.js';

interface MessageReactionsProps {
  reactions: ReactionSummary[];
  /** onClick lets parent open the reaction picker for quick toggle */
  onReactionClick?: (reaction: string) => void;
  /** className override for positioning */
  className?: string;
}

/**
 * Renders a compact row of emoji+count badges below a message bubble.
 * Example:  ❤️ 3   😂 1
 *
 * Clicking a badge that the viewer has already selected removes it;
 * clicking a different one replaces their current reaction.
 */
export const MessageReactions: React.FC<MessageReactionsProps> = ({
  reactions,
  onReactionClick,
  className = '',
}) => {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap gap-1 mt-1 ${className}`}
      role="list"
      aria-label="Message reactions"
    >
      {reactions.map((r) => {
        const isMine = Boolean(r.myReactionId);
        return (
          <button
            key={r.reaction}
            type="button"
            role="listitem"
            onClick={() => onReactionClick?.(r.reaction)}
            aria-label={`${r.reaction} ${r.count} reaction${r.count !== 1 ? 's' : ''}${isMine ? ', yours' : ''}`}
            aria-pressed={isMine}
            className={`
              inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
              transition-all duration-150 hover:scale-105 active:scale-100 focus:outline-none
              focus-visible:ring-2 focus-visible:ring-brand-500
              ${isMine
                ? 'bg-brand-500/25 border border-brand-500/50 text-brand-200'
                : 'bg-slate-800/70 border border-slate-700/60 text-slate-300 hover:bg-slate-700/70'}
            `}
          >
            <span role="img" aria-hidden="true">{r.reaction}</span>
            <span className={isMine ? 'text-brand-300' : 'text-slate-400'}>
              {r.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
