import React, { useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';

interface UnsendMessageDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** If true the Unsend button shows a spinner */
  isPending?: boolean;
}

/**
 * Confirmation dialog before unsending a message.
 * Does NOT expose database terminology.
 * Trap focus, close on Escape, close on backdrop click.
 */
export const UnsendMessageDialog: React.FC<UnsendMessageDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isPending = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  // Auto-focus the confirm button for keyboard users
  useEffect(() => {
    if (isOpen) {
      confirmRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsend-title"
      aria-describedby="unsend-desc"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onCancel}
      />

      <div
        ref={dialogRef}
        className="
          relative z-10 w-full max-w-sm
          bg-slate-900/98 backdrop-blur-xl
          border border-slate-700/60
          rounded-2xl shadow-aurora-glass
          p-6
          animate-in fade-in zoom-in-95 duration-150
        "
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30
                          flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-rose-400" aria-hidden="true" />
          </div>
        </div>

        {/* Title */}
        <h2
          id="unsend-title"
          className="text-base font-bold text-white text-center mb-2"
        >
          Unsend message?
        </h2>

        {/* Description */}
        <p
          id="unsend-desc"
          className="text-sm text-slate-400 text-center mb-6 leading-relaxed"
        >
          This message will be removed from the conversation.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="
              w-full py-2.5 rounded-xl font-semibold text-sm
              bg-rose-600 hover:bg-rose-500 text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500
              flex items-center justify-center gap-2
            "
          >
            {isPending && (
              <span
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                aria-hidden="true"
              />
            )}
            Unsend
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="
              w-full py-2.5 rounded-xl font-medium text-sm
              bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white
              disabled:opacity-50
              transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500
            "
          >
            Cancel
          </button>
        </div>

        {/* Close × */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close dialog"
          className="
            absolute top-3 right-3 p-1.5 rounded-full text-slate-500
            hover:text-white hover:bg-slate-700/60
            transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
          "
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
