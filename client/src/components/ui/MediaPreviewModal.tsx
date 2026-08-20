import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download, RotateCcw } from 'lucide-react';
import { Avatar } from './Avatar.js';

interface MediaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  authorName?: string;
  authorUsername?: string;
  authorAvatar?: string;
  caption?: string;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  isOpen,
  onClose,
  mediaUrl,
  authorName,
  authorUsername,
  authorAvatar,
  caption
}) => {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      setZoom(1);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = `nexa-media-${Date.now()}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isVideo = mediaUrl && (
    mediaUrl.startsWith('data:video/') || 
    mediaUrl.includes('/uploads/videos/') || 
    /\.(mp4|webm|mov|mkv|avi)$/i.test(mediaUrl)
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-2 sm:p-6 animate-in fade-in duration-200 select-none">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        {/* Author Info */}
        <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-3.5 py-2 rounded-full border border-slate-800 shadow-xl">
          {authorName && <Avatar src={authorAvatar} name={authorName} size="sm" />}
          <div>
            {authorName && <h4 className="text-xs font-bold text-white leading-tight">{authorName}</h4>}
            {authorUsername && <span className="text-[11px] text-slate-400">@{authorUsername}</span>}
          </div>
        </div>

        {/* Media Controls */}
        <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-1.5 rounded-full border border-slate-800 shadow-xl">
          {!isVideo && (
            <>
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-300 min-w-[40px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
                title="Reset Zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={handleDownload}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            title="Download Media"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-rose-600/80 text-white hover:bg-rose-600 rounded-full transition-colors ml-1 shadow-lg"
            title="Close Preview (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Center Media Area */}
      <div
        className="w-full h-full flex flex-col items-center justify-center max-w-6xl max-h-[88vh] overflow-auto rounded-3xl p-2 cursor-zoom-out"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative flex flex-col items-center justify-center max-w-full max-h-full">
          {isVideo ? (
            <video
              src={mediaUrl}
              controls
              autoPlay
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-slate-800/60"
            />
          ) : (
            <img
              src={mediaUrl}
              alt="Full high res post preview"
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-slate-800/60 transition-transform duration-150 cursor-grab active:cursor-grabbing"
              style={{ transform: `scale(${zoom})` }}
            />
          )}

          {/* Caption Footer */}
          {caption && (
            <div className="mt-4 max-w-2xl bg-slate-900/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-800 text-slate-200 text-xs leading-relaxed text-center shadow-xl">
              <p>{caption}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
