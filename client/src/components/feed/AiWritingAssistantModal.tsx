import React, { useState } from 'react';
import { Sparkles, Check, X, Loader2, ArrowRight, Wand2, RefreshCw, Languages, Hash, Scissors, CheckCheck, Award, MessageCircle } from 'lucide-react';
import { aiApi, AiWritingOperation } from '../../api/ai.api.js';

interface AiWritingAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentText: string;
  onAccept: (newText: string) => void;
}

export const AiWritingAssistantModal: React.FC<AiWritingAssistantModalProps> = ({
  isOpen,
  onClose,
  currentText,
  onAccept
}) => {
  const [selectedOp, setSelectedOp] = useState<AiWritingOperation>('improve_writing');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const operations: Array<{
    id: AiWritingOperation;
    label: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'generate_caption',
      label: 'Generate Caption',
      description: 'Craft catchy, viral caption with trending hashtags',
      icon: <Wand2 className="w-4 h-4 text-purple-400" />
    },
    {
      id: 'improve_writing',
      label: 'Improve Writing',
      description: 'Enhance clarity, phrasing, and flow',
      icon: <Sparkles className="w-4 h-4 text-brand-400" />
    },
    {
      id: 'fix_grammar',
      label: 'Fix Grammar',
      description: 'Correct spelling, punctuation, and typos',
      icon: <CheckCheck className="w-4 h-4 text-emerald-400" />
    },
    {
      id: 'shorten',
      label: 'Shorten',
      description: 'Make text concise, punchy, and brief',
      icon: <Scissors className="w-4 h-4 text-amber-400" />
    },
    {
      id: 'make_professional',
      label: 'Make Professional',
      description: 'Polished, articulate, and formal tone',
      icon: <Award className="w-4 h-4 text-blue-400" />
    },
    {
      id: 'make_casual',
      label: 'Make Casual',
      description: 'Relaxed, friendly, and conversational vibe',
      icon: <MessageCircle className="w-4 h-4 text-cyan-400" />
    },
    {
      id: 'generate_hashtags',
      label: 'Generate Hashtags',
      description: 'Extract 5-10 relevant trending tags',
      icon: <Hash className="w-4 h-4 text-pink-400" />
    },
    {
      id: 'translate',
      label: 'Translate',
      description: 'Translate into natural multilingual text',
      icon: <Languages className="w-4 h-4 text-indigo-400" />
    }
  ];

  const handleGenerate = async (opToRun?: AiWritingOperation) => {
    const op = opToRun || selectedOp;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await aiApi.assistWriting(
        op,
        currentText,
        op === 'translate' ? targetLang : undefined
      );
      setPreviewText(response.result);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to generate suggestion. Please try again.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (previewText) {
      onAccept(previewText);
      onClose();
    }
  };

  const handleDiscard = () => {
    setPreviewText(null);
    setErrorMsg(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-background-card border border-slate-700/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-background/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-brand-600 to-aurora-cyan text-white shadow-glow-brand">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                ✨ Improve with NEXA AI
              </h2>
              <p className="text-[11px] text-slate-400">
                Transform your draft with AI writing assistance
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Operation Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-2 block">
              Choose Writing Operation
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {operations.map((op) => {
                const isSelected = selectedOp === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => {
                      setSelectedOp(op.id);
                      void handleGenerate(op.id);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-brand-600/20 border-brand-500 text-white shadow-glow-brand ring-1 ring-brand-500/40'
                        : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {op.icon}
                      <span className="text-xs font-semibold truncate">{op.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 line-clamp-1">{op.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Translation Language Selector */}
          {selectedOp === 'translate' && (
            <div className="flex items-center gap-2 p-2.5 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
              <Languages className="w-4 h-4 text-indigo-400" />
              <span className="text-slate-300 font-medium">Target Language:</span>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-brand-500"
              >
                <option value="Spanish">Spanish (Español)</option>
                <option value="French">French (Français)</option>
                <option value="German">German (Deutsch)</option>
                <option value="Japanese">Japanese (日本語)</option>
                <option value="Portuguese">Portuguese (Português)</option>
                <option value="Arabic">Arabic (العربية)</option>
                <option value="Hindi">Hindi (हिन्दी)</option>
                <option value="Russian">Russian (Русский)</option>
                <option value="Chinese">Chinese (中文)</option>
              </select>
              <button
                type="button"
                onClick={() => handleGenerate()}
                className="ml-auto px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold"
              >
                Translate Now
              </button>
            </div>
          )}

          {/* Original draft viewer */}
          <div>
            <span className="text-xs font-semibold text-slate-400 mb-1 block">
              Original Draft:
            </span>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300 max-h-24 overflow-y-auto whitespace-pre-wrap">
              {currentText.trim() ? currentText : <span className="italic text-slate-500">(No text draft entered yet)</span>}
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <X className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Output */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-aurora-cyan flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> AI Suggestion Preview:
              </span>
              {previewText && (
                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  disabled={isLoading}
                  className="text-[11px] text-slate-400 hover:text-aurora-cyan flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              )}
            </div>

            <div className="relative p-3.5 bg-slate-900/90 rounded-xl border border-brand-500/40 min-h-[100px] text-xs sm:text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-6 h-6 animate-spin text-aurora-cyan" />
                  <span>Generating with NEXA AI...</span>
                </div>
              ) : previewText ? (
                previewText
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs italic">
                  Select an operation above to generate an AI preview
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions (Explicit Accept / Discard) */}
        <div className="p-4 border-t border-slate-800 bg-background/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDiscard}
            className="px-4 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all"
          >
            Discard
          </button>

          <div className="flex items-center gap-2">
            {!previewText && (
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={isLoading}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-aurora-cyan" />}
                <span>Generate Preview</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleApply}
              disabled={!previewText || isLoading}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
                previewText && !isLoading
                  ? 'bg-gradient-to-r from-brand-600 to-aurora-cyan text-white hover:opacity-95 active:scale-95 shadow-glow-brand cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Accept & Replace Draft</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
