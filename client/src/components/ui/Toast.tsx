import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastProps {
  id: string;
  message: string;
  variant?: ToastVariant;
  durationMs?: number;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  message,
  variant = 'info',
  durationMs = 4000,
  onDismiss
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [id, durationMs, onDismiss]);

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200';
      case 'error':
        return 'bg-rose-950/90 border-rose-500/50 text-rose-200';
      default:
        return 'bg-slate-900/90 border-purple-500/50 text-purple-200';
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-purple-400 shrink-0" />;
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg transition-all ${getVariantStyles()}`}
    >
      {getIcon()}
      <span className="text-xs font-medium flex-1">{message}</span>
      <button
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
