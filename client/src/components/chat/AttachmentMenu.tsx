import React from 'react';
import { Image, Video, FileText, Music, X } from 'lucide-react';

export type AttachmentType = 'music' | 'image' | 'video' | 'file';

interface AttachmentMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: AttachmentType) => void;
  disabled?: boolean;
}

export const AttachmentMenu: React.FC<AttachmentMenuProps> = ({
  isOpen,
  onClose,
  onSelect,
  disabled
}) => {
  if (!isOpen) return null;

  const options: { type: AttachmentType; label: string; icon: React.ReactNode; color: string }[] = [
    { type: 'image', label: 'Photo', icon: <Image className="w-5 h-5" />, color: 'text-emerald-400 bg-emerald-400/10' },
    { type: 'video', label: 'Video', icon: <Video className="w-5 h-5" />, color: 'text-purple-400 bg-purple-400/10' },
    { type: 'music', label: 'Jamendo Music', icon: <Music className="w-5 h-5" />, color: 'text-brand-400 bg-brand-400/10' },
    { type: 'file', label: 'Document', icon: <FileText className="w-5 h-5" />, color: 'text-blue-400 bg-blue-400/10' },
  ];

  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose} 
      />
      <div className="absolute bottom-[60px] left-2 sm:left-4 z-50 w-64 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-xl overflow-hidden animate-slideUp">
        <div className="p-3 border-b border-slate-800/80 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Attach</span>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-2 grid grid-cols-2 gap-2">
          {options.map((opt) => (
            <button
              key={opt.type}
              type="button"
              disabled={disabled}
              onClick={() => {
                onSelect(opt.type);
                onClose();
              }}
              className="flex flex-col items-center justify-center p-3 rounded-xl hover:bg-slate-800/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className={`p-3 rounded-full mb-2 group-hover:scale-110 transition-transform ${opt.color}`}>
                {opt.icon}
              </div>
              <span className="text-xs font-medium text-slate-300 group-hover:text-white">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
