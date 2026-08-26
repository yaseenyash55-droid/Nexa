import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { ZoomIn, ZoomOut, RotateCw, RefreshCw, Check } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string | null;
  aspectRatio: number; // e.g. 1 for avatar, 2.5 for banner
  cropShape?: 'round' | 'rect';
  title?: string;
  onCropComplete: (croppedFile: File, previewUrl: string) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  aspectRatio = 1,
  cropShape = 'rect',
  title = 'Crop Image',
  onCropComplete
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset state when opening a new image
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetStartRef.current = { ...offset };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: offsetStartRef.current.x + dx,
      y: offsetStartRef.current.y + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.002;
    setZoom((prev) => Math.min(Math.max(1, prev + delta), 4));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  const handleApplyCrop = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const container = containerRef.current;

    // Dimensions of crop window in DOM pixels
    const cropWidth = container.clientWidth;
    const cropHeight = container.clientHeight;

    // Target output dimensions
    const outputWidth = cropShape === 'round' ? 800 : 1200;
    const outputHeight = Math.round(outputWidth / aspectRatio);

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Enable high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Center canvas coordinate system
    ctx.translate(outputWidth / 2, outputHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    // Scale calculation from displayed container size to exported canvas size
    const scaleFactor = outputWidth / cropWidth;

    // Compute dimensions of image when rendered to fit container at zoom = 1
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    const imgAspect = naturalWidth / naturalHeight;
    let renderW = cropWidth;
    let renderH = cropHeight;

    if (imgAspect > aspectRatio) {
      renderH = cropHeight;
      renderW = cropHeight * imgAspect;
    } else {
      renderW = cropWidth;
      renderH = cropWidth / imgAspect;
    }

    // Apply zoom & offset
    const drawnW = renderW * zoom * scaleFactor;
    const drawnH = renderH * zoom * scaleFactor;
    const drawnX = (offset.x * scaleFactor) - (drawnW / 2);
    const drawnY = (offset.y * scaleFactor) - (drawnH / 2);

    ctx.drawImage(img, drawnX, drawnY, drawnW, drawnH);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], `cropped_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const previewUrl = URL.createObjectURL(blob);
      onCropComplete(croppedFile, previewUrl);
      onClose();
    }, 'image/jpeg', 0.92);
  }, [aspectRatio, cropShape, offset, rotation, zoom, onCropComplete, onClose]);

  if (!isOpen || !imageSrc) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        {/* Cropping Viewport Container */}
        <div className="relative w-full flex items-center justify-center bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 p-2 sm:p-4 select-none">
          <div
            ref={containerRef}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              aspectRatio: `${aspectRatio}`,
              maxHeight: '360px'
            }}
            className={`relative w-full overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing border-2 border-brand-500/80 shadow-2xl bg-black ${
              cropShape === 'round' ? 'rounded-full max-w-[280px] sm:max-w-[320px]' : 'rounded-xl'
            }`}
          >
            {/* Target Image being positioned */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop preview"
              draggable={false}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
              className="max-w-none pointer-events-none object-contain select-none will-change-transform"
            />

            {/* Grid overlay for rule-of-thirds alignment */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30 border border-white/20">
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-r border-b border-white/30" />
              <div className="border-b border-white/30" />
              <div className="border-r border-white/30" />
              <div className="border-r border-white/30" />
              <div />
            </div>
          </div>
        </div>

        {/* Zoom & Adjustment Controls */}
        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
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
            <ZoomIn className="w-4 h-4 text-brand-400 shrink-0" />
            <span className="text-xs text-slate-400 w-10 text-right font-mono">{zoom.toFixed(1)}x</span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
            <p className="text-[11px] text-slate-400">Drag to reposition / scroll to zoom</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRotate}
                title="Rotate 90°"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotate</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                title="Reset Position"
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleApplyCrop}>
            <Check className="w-4 h-4 mr-1.5" /> Apply & Crop
          </Button>
        </div>
      </div>
    </Modal>
  );
};
