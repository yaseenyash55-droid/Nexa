import React, { useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';

interface EditMessageComposerProps {
  /** Initial text to pre-populate the edit field */
  initialContent: string;
  /** Called with new text on Save */
  onSave: (content: string) => void;
  /** Called when the user cancels the edit */
  onCancel: () => void;
  /** If true the save button shows a spinner and is disabled */
  isSaving?: boolean;
  /** Optional error to display below the input */
  error?: string | null;
}

/**
 * Indicator strip + editable textarea shown above the composer when the
 * user chooses to edit a message.  It is deliberately separate from the
 * main ChatComposer so it can be mounted/unmounted cleanly.
 */
export const EditMessageComposer: React.FC<EditMessageComposerProps> = ({
  initialContent,
  onSave,
  onCancel,
  isSaving = false,
  error,
}) => {
  const [text, setText] = React.useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus and place cursor at end
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleSave = () => {
    const trimmed = text.trim();
    if (!trimmed || isSaving) return;
    onSave(trimmed);
  };

  return (
    <div
      className="
        border-t border-slate-700/50
        bg-slate-900/90 backdrop-blur-sm
        animate-in slide-in-from-bottom-2 duration-150
      "
    >
      {/* "Editing message" header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60">
        <span className="text-xs font-semibold text-brand-300 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" aria-hidden="true" />
          Editing message
        </span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel editing"
          className="
            p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700/60
            transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
          "
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Editable text area */}
      <div className="flex items-end gap-2 px-3 py-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Edit message text"
          rows={1}
          className="
            flex-1 resize-none bg-transparent text-white text-sm
            placeholder:text-slate-500 focus:outline-none
            max-h-32 overflow-y-auto leading-relaxed
          "
          style={{ height: 'auto' }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
          }}
        />

        {/* Cancel */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          disabled={isSaving}
          className="
            p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-700/60
            transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
            disabled:opacity-40
          "
        >
          <X className="w-4 h-4" />
        </button>

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          aria-label="Save edit"
          disabled={!text.trim() || isSaving}
          className="
            p-2 rounded-full bg-brand-600 text-white
            hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed
            transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400
          "
        >
          {isSaving
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin block" aria-hidden="true" />
            : <Check className="w-4 h-4" />
          }
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p role="alert" className="px-4 pb-2 text-xs text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
};
