import React, { useRef, useEffect, useState } from 'react';

export type CameraFilterPreset = 'normal' | 'vintage-warmth' | 'cyberpunk-neon' | 'dramatic-bw' | 'retro-vhs';

export interface CameraFilterViewProps {
  onCapturePhoto?: (dataUrl: string) => void;
}

export const CameraFilterView: React.FC<CameraFilterViewProps> = ({ onCapturePhoto }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<CameraFilterPreset>('normal');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsStreaming(true);
        }
      } catch (err) {
        console.warn('Camera access not granted or unavailable:', err);
      }
    }
    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const getFilterCss = (filter: CameraFilterPreset): string => {
    switch (filter) {
      case 'vintage-warmth':
        return 'sepia(40%) contrast(110%) brightness(105%) saturate(130%)';
      case 'cyberpunk-neon':
        return 'hue-rotate(180deg) saturate(180%) contrast(125%)';
      case 'dramatic-bw':
        return 'grayscale(100%) contrast(150%) brightness(90%)';
      case 'retro-vhs':
        return 'contrast(120%) saturate(140%) sepia(20%)';
      default:
        return 'none';
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    ctx.filter = getFilterCss(selectedFilter);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png');
    if (onCapturePhoto) {
      onCapturePhoto(dataUrl);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-slate-900 rounded-xl border border-slate-800 text-white">
      <div className="relative w-full max-w-md aspect-video bg-black rounded-lg overflow-hidden border border-slate-700">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ filter: getFilterCss(selectedFilter) }}
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Safety Guard Indicator */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] text-emerald-400 flex items-center gap-1 border border-emerald-500/30">
          <span>✓ Safety Guard Active: No Body Reshaping</span>
        </div>
      </div>

      {/* Filter Selector Buttons */}
      <div className="flex flex-wrap gap-2 justify-center">
        {(['normal', 'vintage-warmth', 'cyberpunk-neon', 'dramatic-bw', 'retro-vhs'] as CameraFilterPreset[]).map(
          (filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedFilter === filter
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {filter.replace('-', ' ').toUpperCase()}
            </button>
          )
        )}
      </div>

      {/* Capture Button */}
      <button
        onClick={handleCapture}
        disabled={!isStreaming}
        className="w-full max-w-md py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg font-semibold text-sm transition-all shadow-md disabled:opacity-50"
      >
        Capture Photo with Filter
      </button>
    </div>
  );
};
