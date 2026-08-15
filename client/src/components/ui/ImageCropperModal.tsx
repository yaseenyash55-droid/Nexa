import React, { useState, useRef, useEffect } from 'react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { ZoomIn, ZoomOut, RotateCw, Check, Move, Disc, Square } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedDataUrl: string) => void;
  title?: string;
  initialAspectRatio?: '1:1' | '4:5' | '16:9';
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete,
  title = "Crop & Adjust Media",
  initialAspectRatio = '1:1'
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [maskType, setMaskType] = useState<'circle' | 'square'>('square');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '16:9'>(initialAspectRatio);

  const imageRef = useRef<HTMLImageElement | null>(null);

  // Reset state when a new image is loaded
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
      setAspectRatio(initialAspectRatio);
    }
  }, [isOpen, imageSrc, initialAspectRatio]);

  // Handle Mouse / Touch Dragging
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - pan.x, y: clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setPan({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleCrop = () => {
    if (!imageRef.current) return;
    const img = imageRef.current;

    let outW = 600;
    let outH = 600;
    if (aspectRatio === '4:5') {
      outW = 600;
      outH = 750;
    } else if (aspectRatio === '16:9') {
      outW = 800;
      outH = 450;
    }

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, outW, outH);
    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    const cropFrameW = aspectRatio === '16:9' ? 320 : aspectRatio === '4:5' ? 220 : 250;
    const cropFrameH = aspectRatio === '16:9' ? 180 : aspectRatio === '4:5' ? 275 : 250;

    const scale = (outW / cropFrameW) * zoom;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;
    const baseScale = Math.max(cropFrameW / imgWidth, cropFrameH / imgHeight);

    const drawW = imgWidth * baseScale * scale;
    const drawH = imgHeight * baseScale * scale;

    const panX = pan.x * (outW / cropFrameW);
    const panY = pan.y * (outH / cropFrameH);

    ctx.drawImage(
      img,
      -drawW / 2 + panX,
      -drawH / 2 + panY,
      drawW,
      drawH
    );

    ctx.restore();

    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onCropComplete(croppedDataUrl);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crop Profile Picture">
      <div className="space-y-5 select-none">
        {/* Crop Area Container */}
        <div
          className="relative w-full h-72 bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing border border-slate-800"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          {/* Base Image */}
          {imageSrc && (
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop preview"
              className="max-w-none pointer-events-none transition-transform duration-75"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
          )}

          {/* Dynamic Mask Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-slate-950/60">
            <div
              className={`border-2 border-brand-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.75)] ${
                maskType === 'circle' && aspectRatio === '1:1' ? 'rounded-full' : 'rounded-2xl'
              }`}
              style={{
                width: aspectRatio === '16:9' ? '320px' : aspectRatio === '4:5' ? '220px' : '250px',
                height: aspectRatio === '16:9' ? '180px' : aspectRatio === '4:5' ? '275px' : '250px'
              }}
            />
          </div>

          {/* Drag Instruction Indicator */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-slate-700/80 text-[10px] text-slate-300 font-medium flex items-center gap-1.5 pointer-events-none">
            <Move className="w-3 h-3 text-brand-400" />
            <span>Drag to reposition photo</span>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
          {/* Aspect Ratio Selector */}
          <div className="space-y-1.5 border-b border-slate-800/80 pb-3">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Aspect Ratio Suitable for Feed & Footages</label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAspectRatio('1:1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  aspectRatio === '1:1'
                    ? 'bg-brand-600 text-white shadow-glow-brand'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                <span>1:1 Square</span>
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('4:5')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  aspectRatio === '4:5'
                    ? 'bg-brand-600 text-white shadow-glow-brand'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                <span>4:5 Portrait</span>
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  aspectRatio === '16:9'
                    ? 'bg-brand-600 text-white shadow-glow-brand'
                    : 'bg-slate-800/60 text-slate-400 hover:text-white'
                }`}
              >
                <span>16:9 Landscape / Video</span>
              </button>
            </div>
          </div>
          {/* Zoom Slider */}
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-300 w-10 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Mask & Rotate Buttons */}
          <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMaskType('circle')}
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  maskType === 'circle'
                    ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white'
                }`}
              >
                <Disc className="w-4 h-4" />
                <span>Circle</span>
              </button>
              <button
                type="button"
                onClick={() => setMaskType('square')}
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  maskType === 'square'
                    ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white'
                }`}
              >
                <Square className="w-4 h-4" />
                <span>Square</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleRotate}
              className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700/50"
            >
              <RotateCw className="w-4 h-4 text-aurora-cyan" />
              <span>Rotate ({rotation}°)</span>
            </button>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button onClick={handleCrop} size="sm" className="gap-1.5">
            <Check className="w-4 h-4" /> Save Cropped Photo
          </Button>
        </div>
      </div>
    </Modal>
  );
};
