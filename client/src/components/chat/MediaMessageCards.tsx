import React from 'react';
import { Download, FileText } from 'lucide-react';
import { CachedMedia } from './CachedMedia.js';

export const ImageMessageCard: React.FC<{ url: string; alt?: string }> = ({ url, alt = 'Image' }) => {
  return (
    <div className="rounded-xl overflow-hidden max-w-[280px] border border-white/10 shadow-md bg-black/20">
      <CachedMedia
        url={url}
        type="image"
        className="w-full max-h-64 object-cover cursor-pointer hover:scale-[1.02] transition duration-200"
        onClick={() => window.open(url, '_blank')}
      />
    </div>
  );
};

export const VideoMessageCard: React.FC<{ url: string }> = ({ url }) => {
  return (
    <div className="rounded-xl overflow-hidden max-w-[300px] border border-white/10 shadow-md bg-black/40">
      <CachedMedia
        url={url}
        type="video"
        controls
        className="w-full max-h-64 rounded-xl"
      />
    </div>
  );
};

export const FileMessageCard: React.FC<{ url: string; fileName?: string }> = ({ url, fileName }) => {
  const displayFileName = fileName || url.split('/').pop()?.split('?')[0] || 'Attachment File';
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 p-2.5 bg-slate-900/70 hover:bg-slate-900 rounded-xl border border-slate-700/50 transition max-w-[280px] group"
    >
      <div className="p-2 bg-brand-500/20 rounded-lg text-brand-300">
        <FileText className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">{decodeURIComponent(displayFileName)}</p>
        <p className="text-[10px] text-brand-300 flex items-center gap-1">Click to download</p>
      </div>
      <Download className="w-4 h-4 text-slate-400 group-hover:text-white transition" />
    </a>
  );
};
