import React from 'react';
import { FileText, Image as ImageIcon, Video, X, Loader2 } from 'lucide-react';
import { ComposerAttachment } from './ChatComposer.js';

interface AttachmentPreviewProps {
  attachment: ComposerAttachment;
  onRemove: () => void;
}

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachment, onRemove }) => {
  if (attachment.type === 'music') {
    return (
      <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 p-2 rounded-xl text-xs text-slate-300 pr-3 relative group">
        <div className="w-8 h-8 rounded bg-slate-900 overflow-hidden shrink-0">
          {attachment.track.artworkUrl && <img src={attachment.track.artworkUrl} alt="Cover" className="w-full h-full object-cover" />}
        </div>
        <div className="flex flex-col min-w-0 max-w-[150px]">
          <span className="font-semibold text-white truncate">{attachment.track.title}</span>
          <span className="text-[10px] text-brand-400 truncate">Jamendo Music</span>
        </div>
        <button 
          onClick={onRemove}
          className="ml-1 w-5 h-5 flex items-center justify-center rounded-full bg-slate-700/50 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
          title="Remove"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const { type, file, progress, error, url } = attachment;

  const renderIcon = () => {
    switch (type) {
      case 'image': return <ImageIcon className="w-4 h-4 text-emerald-400" />;
      case 'video': return <Video className="w-4 h-4 text-purple-400" />;
      case 'file': return <FileText className="w-4 h-4 text-blue-400" />;
      default: return null;
    }
  };

  const getPreviewUrl = () => {
    if (url) return url;
    if (file && (type === 'image' || type === 'video')) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  const previewUrl = getPreviewUrl();

  return (
    <div className={`flex items-center gap-2 bg-slate-800/80 border ${error ? 'border-rose-500' : 'border-slate-700'} p-2 rounded-xl text-xs text-slate-300 pr-3 relative overflow-hidden group min-w-[120px] max-w-[200px]`}>
      <div className="w-8 h-8 rounded bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center relative">
        {previewUrl ? (
          type === 'image' ? (
            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          ) : type === 'video' ? (
            <video src={previewUrl} className="w-full h-full object-cover" />
          ) : (
            renderIcon()
          )
        ) : (
          renderIcon()
        )}
        {progress !== undefined && progress < 100 && !error && (
          <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
          </div>
        )}
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-medium text-slate-200 truncate" title={file?.name || 'Attachment'}>
          {file?.name || 'Attachment'}
        </span>
        {error ? (
          <span className="text-[10px] text-rose-400 truncate">{error}</span>
        ) : progress !== undefined && progress < 100 ? (
          <span className="text-[10px] text-brand-400 truncate">Uploading {Math.round(progress)}%</span>
        ) : (
          <span className="text-[10px] text-slate-500 truncate">
            {file ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : 'Ready'}
          </span>
        )}
      </div>
      
      {/* Remove Button */}
      <button 
        onClick={onRemove}
        className="ml-1 w-5 h-5 flex items-center justify-center rounded-full bg-slate-700/50 hover:bg-rose-500/20 hover:text-rose-400 transition-colors shrink-0 z-10"
        title="Remove"
      >
        <X className="w-3 h-3" />
      </button>

      {/* Progress Bar Background */}
      {progress !== undefined && progress < 100 && !error && (
        <div className="absolute bottom-0 left-0 h-0.5 bg-brand-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      )}
    </div>
  );
};
