import React, { useRef, useEffect } from 'react';
import { Send, Square, Sparkles } from 'lucide-react';

interface AiComposerProps {
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const AiComposer: React.FC<AiComposerProps> = ({
  input,
  setInput,
  onSend,
  onStop,
  isLoading,
  disabled = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim() && !disabled) {
        onSend();
      }
    }
  };

  return (
    <div className="relative border-t border-slate-800/80 bg-background/90 backdrop-blur-md p-3 sm:p-4">
      <div className="relative flex items-end gap-2 bg-background-card/80 border border-slate-700/60 rounded-2xl p-2 focus-within:border-brand-500/80 focus-within:ring-2 focus-within:ring-brand-500/30 transition-all shadow-inner">
        <div className="p-2 text-aurora-cyan hidden sm:block">
          <Sparkles className="w-5 h-5 animate-pulse-slow" />
        </div>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask NEXA AI anything... (Shift + Enter for new line)"
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-xs sm:text-sm resize-none focus:outline-none max-h-40 py-2 px-1 leading-relaxed"
          aria-label="Ask NEXA AI"
        />

        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            className="p-2.5 bg-rose-600/20 text-rose-400 hover:bg-rose-600/30 border border-rose-500/40 rounded-xl transition-all flex items-center justify-center flex-shrink-0 shadow-sm"
            title="Stop generating"
            aria-label="Stop generation"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!input.trim() || disabled}
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center flex-shrink-0 shadow-md ${
              input.trim() && !disabled
                ? 'bg-gradient-to-r from-brand-600 to-aurora-cyan text-white hover:opacity-95 active:scale-95 shadow-glow-brand cursor-pointer'
                : 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
            }`}
            title="Send message"
            aria-label="Send message to NEXA AI"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="text-center mt-1.5">
        <span className="text-[10px] text-slate-500">
          NEXA AI can assist with captions, summaries, translations, and questions.
        </span>
      </div>
    </div>
  );
};
