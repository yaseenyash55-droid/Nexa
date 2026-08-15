import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full max-w-lg bg-slate-900 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-white max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto sm:hidden mb-2" />
          {title && <h3 className="text-sm font-bold text-slate-100">{title}</h3>}
          <button
            onClick={onClose}
            aria-label="Close bottom sheet"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};
