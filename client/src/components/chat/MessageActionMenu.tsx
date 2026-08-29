import React, { useEffect, useRef, useCallback } from 'react';
import { Reply, Copy, Pencil, Trash2, MoreHorizontal, X } from 'lucide-react';
import { ReactionPicker } from './ReactionPicker.js';

export interface MessageActionMenuProps {
  isOpen: boolean;
  onClose: () => void;

  // Authorization matrix — determined by caller from server-authoritative data
  canReact: boolean;
  canReply: boolean;
  canCopy: boolean;
  canEdit: boolean;
  canUnsend: boolean;

  currentReaction?: string | null;

  onReact: (emoji: string) => void;
  onRemoveReaction: () => void;
  onReply: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onUnsend: () => void;

  /**
   * Anchor element (the message bubble) used to position the menu.
   * If null the menu is centred.
   */
  anchorRef?: React.RefObject<HTMLElement | null>;
  isSelf: boolean;
}

const ACTION_ITEMS = [
  { id: 'reply',  label: 'Reply',  icon: Reply,       gate: 'canReply',  danger: false },
  { id: 'copy',   label: 'Copy',   icon: Copy,        gate: 'canCopy',   danger: false },
  { id: 'edit',   label: 'Edit',   icon: Pencil,      gate: 'canEdit',   danger: false },
  { id: 'unsend', label: 'Unsend', icon: Trash2,       gate: 'canUnsend', danger: true  },
] as const;

type ActionId = typeof ACTION_ITEMS[number]['id'];

export const MessageActionMenu: React.FC<MessageActionMenuProps> = ({
  isOpen,
  onClose,
  canReact,
  canReply,
  canCopy,
  canEdit,
  canUnsend,
  currentReaction,
  onReact,
  onRemoveReaction,
  onReply,
  onCopy,
  onEdit,
  onUnsend,
  anchorRef,
  isSelf,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [extended, setExtended] = React.useState(false);

  const gateMap: Record<string, boolean> = {
    canReply,
    canCopy,
    canEdit,
    canUnsend,
  };

  // Close on click-outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Trap focus inside menu
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;
    const focusable = menuRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable[0]?.focus();
  }, [isOpen, extended]);

  const handleAction = useCallback((id: ActionId) => {
    onClose();
    switch (id) {
      case 'reply':  onReply();  break;
      case 'copy':   onCopy();   break;
      case 'edit':   onEdit();   break;
      case 'unsend': onUnsend(); break;
    }
  }, [onClose, onReply, onCopy, onEdit, onUnsend]);

  if (!isOpen) return null;

  return (
    /* Semi-opaque backdrop — click-outside handled by mousedown listener */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Message actions"
    >
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        ref={menuRef}
        className="
          relative z-10 w-full max-w-xs
          bg-slate-900/95 backdrop-blur-xl
          border border-slate-700/60
          rounded-2xl shadow-aurora-glass
          overflow-hidden
          animate-in fade-in zoom-in-95 duration-150
        "
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 p-1.5 rounded-full text-slate-500
                     hover:text-white hover:bg-slate-700/60 transition focus:outline-none
                     focus-visible:ring-2 focus-visible:ring-brand-500 z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── Quick reactions ── */}
        {canReact && (
          <div className="px-3 pt-3 pb-2 border-b border-slate-800/60">
            <ReactionPicker
              currentReaction={currentReaction}
              onReact={(emoji) => { onReact(emoji); onClose(); }}
              onRemove={() => { onRemoveReaction(); onClose(); }}
              extended={extended}
              onToggleExtended={() => setExtended((v) => !v)}
              className="justify-center"
            />
          </div>
        )}

        {/* ── Action list ── */}
        <ul className="py-1" role="menu">
          {ACTION_ITEMS.map(({ id, label, icon: Icon, gate, danger }) => {
            const allowed = gateMap[gate];
            if (!allowed) return null;
            return (
              <li key={id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleAction(id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium
                    transition-colors focus:outline-none
                    focus-visible:bg-slate-800/60
                    ${danger
                      ? 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300'
                      : 'text-slate-200 hover:bg-slate-800/60 hover:text-white'}
                  `}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
