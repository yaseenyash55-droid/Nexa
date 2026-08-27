import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/Button.js';
import { X, Type, Undo2, Redo2, Palette, Sparkles } from 'lucide-react';

interface TextItem {
  id: string;
  text: string;
  color: string;
  fontSize: number;
  x: number;
  y: number;
}

interface DrawPath {
  color: string;
  points: { x: number; y: number }[];
}

interface EditorState {
  paths: DrawPath[];
  texts: TextItem[];
  filter: string;
}

interface StoryEditorProps {
  file: File;
  onSave: (editedFile: File) => void;
  onCancel: () => void;
}

const FILTERS = [
  { name: 'Original', value: 'none' },
  { name: 'Warm', value: 'sepia(30%) saturate(140%)' },
  { name: 'Cool', value: 'hue-rotate(30deg) saturate(110%)' },
  { name: 'B&W', value: 'grayscale(100%)' },
  { name: 'High Contrast', value: 'contrast(150%)' }
];

const BRUSH_COLORS = ['#ffffff', '#ff4b4b', '#4bff4b', '#4b96ff', '#ffd24b', '#e04bff'];

export const StoryEditor: React.FC<StoryEditorProps> = ({ file, onSave, onCancel }) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [filter, setFilter] = useState<string>('none');
  const [brushColor, setBrushColor] = useState<string>('#ffffff');
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [paths, setPaths] = useState<DrawPath[]>([]);

  // Undo/Redo Stacks
  const [history, setHistory] = useState<EditorState[]>([{ paths: [], texts: [], filter: 'none' }]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Dragging states
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef<boolean>(false);
  const currentPath = useRef<DrawPath | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImageSrc(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }, [file]);

  const saveToHistory = (newPaths: DrawPath[], newTexts: TextItem[], newFilter: string) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    const newState = { paths: newPaths, texts: newTexts, filter: newFilter };
    setHistory([...nextHistory, newState]);
    setHistoryIndex(nextHistory.length);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      const state = history[prevIndex];
      setPaths(state.paths);
      setTexts(state.texts);
      setFilter(state.filter);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      const state = history[nextIndex];
      setPaths(state.paths);
      setTexts(state.texts);
      setFilter(state.filter);
    }
  };

  // Canvas drawing handlers
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Scale back to canvas logical dimensions
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode) return;
    isDrawing.current = true;
    const coords = getCanvasCoords(e);
    currentPath.current = { color: brushColor, points: [coords] };
    drawCurrentPath();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || !currentPath.current) return;
    const coords = getCanvasCoords(e);
    currentPath.current.points.push(coords);
    drawCurrentPath();
  };

  const stopDrawing = () => {
    if (!isDrawing.current || !currentPath.current) return;
    isDrawing.current = false;
    const newPaths = [...paths, currentPath.current];
    setPaths(newPaths);
    saveToHistory(newPaths, texts, filter);
    currentPath.current = null;
  };

  const drawCurrentPath = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw saved paths
    paths.forEach(p => {
      if (p.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) {
        ctx.lineTo(p.points[i].x, p.points[i].y);
      }
      ctx.stroke();
    });

    // Draw active path
    const p = currentPath.current;
    if (p && p.points.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) {
        ctx.lineTo(p.points[i].x, p.points[i].y);
      }
      ctx.stroke();
    }
  };

  useEffect(() => {
    drawCurrentPath();
  }, [paths]);

  // Text management
  const addText = () => {
    const textInput = prompt('Enter your overlay text:');
    if (!textInput) return;
    const newItem: TextItem = {
      id: Math.random().toString(),
      text: textInput,
      color: brushColor,
      fontSize: 24,
      x: 100,
      y: 150
    };
    const nextTexts = [...texts, newItem];
    setTexts(nextTexts);
    saveToHistory(paths, nextTexts, filter);
  };

  // Drag text handlers
  const handleTextMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const textObj = texts.find(t => t.id === id);
    if (!textObj) return;
    setDraggingTextId(id);
    setDragOffset({
      x: e.clientX - textObj.x,
      y: e.clientY - textObj.y
    });
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (!draggingTextId) return;
    const nextTexts = texts.map(t => {
      if (t.id === draggingTextId) {
        return {
          ...t,
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        };
      }
      return t;
    });
    setTexts(nextTexts);
  };

  const handleContainerMouseUp = () => {
    if (draggingTextId) {
      setDraggingTextId(null);
      saveToHistory(paths, texts, filter);
    }
  };

  // Flatten and Export
  const handleExport = () => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = img.naturalWidth;
      finalCanvas.height = img.naturalHeight;
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) return;

      // 1. Apply active filter
      const activeFilter = FILTERS.find(f => f.name === filter);
      ctx.filter = activeFilter ? activeFilter.value : 'none';

      // 2. Draw background image
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none'; // Reset filter

      // 3. Draw drawing paths scaled to natural size
      const container = containerRef.current;
      if (container) {
        const clientW = container.clientWidth;
        const clientH = container.clientHeight;
        const scaleX = img.naturalWidth / clientW;
        const scaleY = img.naturalHeight / clientH;

        ctx.lineWidth = 6 * scaleX;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        paths.forEach(p => {
          if (p.points.length < 2) return;
          ctx.beginPath();
          ctx.strokeStyle = p.color;
          // Coordinates in paths are scaled to drawingCanvasRef logical dimensions
          const logicalW = drawingCanvasRef.current?.width || clientW;
          const logicalH = drawingCanvasRef.current?.height || clientH;
          const mapX = img.naturalWidth / logicalW;
          const mapY = img.naturalHeight / logicalH;

          ctx.moveTo(p.points[0].x * mapX, p.points[0].y * mapY);
          for (let i = 1; i < p.points.length; i++) {
            ctx.lineTo(p.points[i].x * mapX, p.points[i].y * mapY);
          }
          ctx.stroke();
        });

        // 4. Draw texts scaled to natural size
        texts.forEach(t => {
          ctx.fillStyle = t.color;
          // Approximate natural font size
          const fontSz = t.fontSize * scaleX;
          ctx.font = `bold ${fontSz}px sans-serif`;
          ctx.textBaseline = 'top';

          // Get offset coordinates relative to container
          const rect = container.getBoundingClientRect();
          const relativeX = (t.x - rect.left) * scaleX;
          const relativeY = (t.y - rect.top) * scaleY;
          ctx.fillText(t.text, relativeX, relativeY);
        });
      }

      finalCanvas.toBlob((blob) => {
        if (blob) {
          const editedFile = new File([blob], file.name, { type: 'image/jpeg' });
          onSave(editedFile);
        }
      }, 'image/jpeg', 0.9);
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between select-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80">
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white transition">
          <X className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={historyIndex <= 0}
            onClick={handleUndo}
            className="p-1.5 bg-slate-800 text-white rounded-full disabled:opacity-40 hover:bg-slate-700 transition"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={historyIndex >= history.length - 1}
            onClick={handleRedo}
            className="p-1.5 bg-slate-800 text-white rounded-full disabled:opacity-40 hover:bg-slate-700 transition"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Center Viewport */}
      <div
        ref={containerRef}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
        className="relative flex-1 bg-black flex items-center justify-center overflow-hidden"
      >
        {imageSrc && (
          <div className="relative max-w-full max-h-[70vh] aspect-[9/16] overflow-hidden flex items-center justify-center border border-slate-800/80 rounded-2xl shadow-glow-brand">
            {/* Background Edited Image with Filter */}
            <img
              src={imageSrc}
              alt="Story Preview"
              style={{ filter: FILTERS.find(f => f.name === filter)?.value }}
              className="w-full h-full object-contain pointer-events-none"
            />

            {/* Drawing Layer */}
            <canvas
              ref={drawingCanvasRef}
              width={720}
              height={1280}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className={`absolute inset-0 w-full h-full ${isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
            />

            {/* Text Overlays */}
            {texts.map(t => (
              <div
                key={t.id}
                onMouseDown={(e) => handleTextMouseDown(e, t.id)}
                style={{
                  position: 'fixed',
                  left: `${t.x}px`,
                  top: `${t.y}px`,
                  color: t.color,
                  fontSize: `${t.fontSize}px`,
                  cursor: 'move',
                  userSelect: 'none'
                }}
                className="font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] select-none px-2 py-1 rounded border border-transparent hover:border-white/20 hover:bg-black/20"
              >
                {t.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Controls Bottom Panel */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 space-y-4">
        {/* Row 1: Brush / Text Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsDrawingMode(!isDrawingMode)}
              className={`p-2.5 rounded-xl border transition ${
                isDrawingMode ? 'bg-brand-500 border-brand-500 text-white' : 'bg-slate-850 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Palette className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={addText}
              className="p-2.5 rounded-xl border bg-slate-850 border-slate-700 text-slate-300 hover:text-white transition"
            >
              <Type className="w-5 h-5" />
            </button>
          </div>

          {/* Color Choices */}
          <div className="flex gap-2">
            {BRUSH_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setBrushColor(c)}
                style={{ backgroundColor: c }}
                className={`w-6 h-6 rounded-full border-2 transition ${brushColor === c ? 'border-white scale-110' : 'border-transparent'}`}
              />
            ))}
          </div>
        </div>

        {/* Row 2: Preset Filters Selection */}
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Presets</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {FILTERS.map(f => (
              <button
                key={f.name}
                type="button"
                onClick={() => {
                  setFilter(f.name);
                  saveToHistory(paths, texts, f.name);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 border transition ${
                  filter === f.name ? 'bg-brand-500 border-brand-500 text-white shadow-glow-brand' : 'bg-slate-850 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {/* Finalize row */}
        <div className="flex justify-end pt-1">
          <Button size="md" onClick={handleExport} rightIcon={<Sparkles className="w-4 h-4" />}>
            Apply & Flatten
          </Button>
        </div>
      </div>
    </div>
  );
};
