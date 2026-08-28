import React, { useState, useEffect } from 'react';
import { mediaCache } from '../../utils/mediaCache.js';

export const CachedMedia: React.FC<{
  url: string;
  type: 'image' | 'video' | 'gif';
  className?: string;
  onClick?: () => void;
  controls?: boolean;
}> = ({ url, type, className, onClick, controls }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let localUrl: string | null = null;

    async function load() {
      try {
        setLoading(true);
        const cached = await mediaCache.getMedia(url);
        if (cached && active) {
          setSrc(cached.objectUrl);
          localUrl = cached.objectUrl;
          setLoading(false);
          return;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error('Fetch failed');
        const blob = await res.blob();
        if (active) {
          const objUrl = URL.createObjectURL(blob);
          setSrc(objUrl);
          localUrl = objUrl;
          setLoading(false);
        }
        await mediaCache.saveMedia(url, blob, res.headers.get('content-type') || '');
      } catch (err) {
        console.error('Failed to load cached media:', err);
        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [url]);

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl min-h-[160px] animate-pulse`}>
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] text-slate-500 font-semibold">Loading media...</span>
        </div>
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl min-h-[160px]`}>
        <span className="text-xs text-rose-400">Failed to load media</span>
      </div>
    );
  }

  if (type === 'image' || type === 'gif') {
    return (
      <img
        src={src}
        alt="Media"
        className={className}
        onClick={onClick}
        loading="lazy"
      />
    );
  }

  if (type === 'video') {
    return (
      <video
        src={src}
        controls={controls}
        playsInline
        className={className}
        preload="metadata"
      />
    );
  }

  return null;
};
