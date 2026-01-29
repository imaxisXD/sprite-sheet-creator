"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpriteProcessor } from '../context/SpriteProcessorContext';
import { calculateCropParameters, applyCropToCanvas, applyCenterCenterCrop, findContentBounds } from '@/app/utils/cropUtils';
import { applyChromaKey } from '@/app/utils/chromaKey';
import type { CropMode, AlignX, AlignY, CanvasSize } from '@/app/types';
import { FRAME_SIZE } from '@/app/config/animation-types';

const CANVAS_PRESETS = [24, 48, 96, 128, 192, 256, 512, 1024];
const BG_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Gray', value: '#808080' },
  { name: 'White', value: '#ffffff' },
  { name: 'Brown', value: '#8B4513' },
  { name: 'Green', value: '#228B22' },
];

export function AutoCropPanel() {
  const { state, dispatch } = useSpriteProcessor();
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const frameIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  const [customWidth, setCustomWidth] = useState<string>('');
  const [customHeight, setCustomHeight] = useState<string>('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const getProcessedFrames = useCallback(() => {
    return state.extractedFrames.map((frame) => {
      if (state.isChromaKeyApplied) {
        return applyChromaKey(frame.processedCanvas, state.chromaKeyColor, state.chromaKeyTolerance);
      }
      return frame.processedCanvas;
    });
  }, [state.extractedFrames, state.isChromaKeyApplied, state.chromaKeyColor, state.chromaKeyTolerance]);

  const getCroppedFrames = useCallback(() => {
    const processedFrames = getProcessedFrames();
    if (processedFrames.length === 0) return [];

    const firstFrame = processedFrames[0];
    const cropParams = calculateCropParameters(
      firstFrame, state.canvasSize, state.reductionAmount, state.cropAlignX, state.cropAlignY
    );

    return processedFrames.map((canvas) => {
      if (state.cropMode === 'animation-relative') {
        return applyCropToCanvas(canvas, cropParams, state.cropAlignX, state.cropAlignY);
      } else {
        return applyCenterCenterCrop(canvas, state.canvasSize, state.reductionAmount, state.cropAlignX, state.cropAlignY);
      }
    });
  }, [getProcessedFrames, state.cropMode, state.canvasSize, state.reductionAmount, state.cropAlignX, state.cropAlignY]);

  const drawBoundingBox = useCallback((ctx: CanvasRenderingContext2D, frame: HTMLCanvasElement) => {
    const bounds = findContentBounds(frame);
    const x = bounds.minX;
    const y = bounds.minY;
    const w = bounds.maxX - bounds.minX + 1;
    const h = bounds.maxY - bounds.minY + 1;

    ctx.save();
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }, []);

  useEffect(() => {
    if (!isAnimating || !previewCanvasRef.current) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const croppedFrames = getCroppedFrames();
    const frameInterval = 1000 / state.previewFps;

    const animate = (timestamp: number) => {
      if (timestamp - lastFrameTimeRef.current >= frameInterval) {
        lastFrameTimeRef.current = timestamp;
        if (croppedFrames.length > 0) {
          const frame = croppedFrames[frameIndexRef.current];
          canvas.width = frame.width;
          canvas.height = frame.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(frame, 0, 0);
          drawBoundingBox(ctx, frame);
          frameIndexRef.current = (frameIndexRef.current + 1) % croppedFrames.length;
        }
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isAnimating, getCroppedFrames, state.previewFps, drawBoundingBox]);

  useEffect(() => {
    if (isAnimating || !previewCanvasRef.current) return;
    const croppedFrames = getCroppedFrames();
    if (croppedFrames.length === 0) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const frame = croppedFrames[0];
    canvas.width = frame.width;
    canvas.height = frame.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(frame, 0, 0);
    drawBoundingBox(ctx, frame);
  }, [isAnimating, getCroppedFrames, drawBoundingBox]);

  const handleCropModeChange = useCallback((mode: CropMode) => {
    dispatch({ type: 'SET_CROP_SETTINGS', payload: { cropMode: mode, isCropApplied: true } });
  }, [dispatch]);

  const handleCanvasSizePreset = useCallback((size: number) => {
    dispatch({ type: 'SET_CROP_SETTINGS', payload: { canvasSize: size, isCropApplied: true } });
    setCustomWidth('');
    setCustomHeight('');
  }, [dispatch]);

  const handleCustomSizeApply = useCallback(() => {
    const width = parseInt(customWidth) || 128;
    const height = parseInt(customHeight) || 128;
    const size: CanvasSize = width === height ? width : { width, height };
    dispatch({ type: 'SET_CROP_SETTINGS', payload: { canvasSize: size, isCropApplied: true } });
  }, [customWidth, customHeight, dispatch]);

  const handleReductionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_CROP_SETTINGS', payload: { reductionAmount: parseInt(e.target.value), isCropApplied: true } });
  }, [dispatch]);

  const handleAlignXChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch({ type: 'SET_CROP_SETTINGS', payload: { cropAlignX: e.target.value as AlignX, isCropApplied: true } });
  }, [dispatch]);

  const handleAlignYChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch({ type: 'SET_CROP_SETTINGS', payload: { cropAlignY: e.target.value as AlignY, isCropApplied: true } });
  }, [dispatch]);

  const handleBgColorChange = useCallback((color: string) => {
    dispatch({ type: 'SET_PREVIEW_SETTINGS', payload: { previewBgColor: color } });
  }, [dispatch]);

  const handleFpsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_PREVIEW_SETTINGS', payload: { previewFps: parseInt(e.target.value) } });
  }, [dispatch]);

  const handleZoomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_PREVIEW_SETTINGS', payload: { previewZoom: parseInt(e.target.value) } });
  }, [dispatch]);

  if (state.extractedFrames.length === 0) return null;

  const currentSize = typeof state.canvasSize === 'number' ? state.canvasSize : state.canvasSize.width;

  return (
    <div className="accordion-section">
      <div className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-3">
          <div className="step-badge text-[11px]">2</div>
          <span className="text-[14px] font-semibold text-[#d4d4d8]">Auto-Crop & Sizing</span>
        </div>
        <svg className={`accordion-chevron ${isOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </div>

      <div className={`accordion-content ${isOpen ? 'expanded' : 'collapsed'}`}>
        <div className="px-5 pb-5 space-y-5">
          <p className="text-[12px] text-[#52525b] leading-relaxed">
            Set canvas dimensions for consistent sprite sizing. Select a preset to start.
          </p>

          {/* Crop Mode */}
          <div>
            <span className="label block mb-2">Crop Mode</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleCropModeChange('animation-relative')}
                className={`btn-toggle flex-1 text-[12px] ${state.cropMode === 'animation-relative' ? 'active' : ''}`}
              >
                Animation Relative
              </button>
              <button
                onClick={() => handleCropModeChange('center-center')}
                className={`btn-toggle flex-1 text-[12px] ${state.cropMode === 'center-center' ? 'active' : ''}`}
              >
                Center-Center
              </button>
            </div>
            <p className="text-[10px] text-[#3f3f46] mt-1.5">
              {state.cropMode === 'animation-relative'
                ? 'First frame determines bounds (preserves movement)'
                : 'Each frame centered individually (good for static poses)'}
            </p>
          </div>

          {/* Canvas Size */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="label">Canvas Size</span>
              <span className="text-[10px] text-[#e63946]/60 font-mono">
                game: {FRAME_SIZE.width}x{FRAME_SIZE.height}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => {
                  const size = { width: FRAME_SIZE.width, height: FRAME_SIZE.height };
                  dispatch({ type: 'SET_CROP_SETTINGS', payload: { canvasSize: size, isCropApplied: true } });
                  setCustomWidth(String(FRAME_SIZE.width));
                  setCustomHeight(String(FRAME_SIZE.height));
                }}
                className={`btn-toggle text-[11px] px-3 py-1.5 border ${
                  typeof state.canvasSize === 'object'
                  && state.canvasSize.width === FRAME_SIZE.width
                  && state.canvasSize.height === FRAME_SIZE.height
                    ? 'active border-[#e63946]/30'
                    : 'border-transparent'
                }`}
              >
                {FRAME_SIZE.width}x{FRAME_SIZE.height}
                <span className="ml-1 opacity-60 text-[9px]">Game</span>
              </button>
              {CANVAS_PRESETS.map((size) => (
                <button
                  key={size}
                  onClick={() => handleCanvasSizePreset(size)}
                  className={`btn-toggle text-[11px] px-3 py-1.5 ${currentSize === size ? 'active' : ''}`}
                >
                  {size}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-2.5 items-center">
              <input
                type="number" placeholder="W" value={customWidth}
                onChange={(e) => setCustomWidth(e.target.value)}
                className="w-16 text-[12px]"
              />
              <span className="text-[#3f3f46] text-[12px]">x</span>
              <input
                type="number" placeholder="H" value={customHeight}
                onChange={(e) => setCustomHeight(e.target.value)}
                className="w-16 text-[12px]"
              />
              <button onClick={handleCustomSizeApply} className="btn-secondary text-[11px]">
                Apply
              </button>
            </div>
          </div>

          {/* Alignment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="label block mb-2">H-Align</span>
              <select value={state.cropAlignX} onChange={handleAlignXChange} className="w-full text-[12px]">
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
            <div>
              <span className="label block mb-2">V-Align</span>
              <select value={state.cropAlignY} onChange={handleAlignYChange} className="w-full text-[12px]">
                <option value="top">Top</option>
                <option value="center">Center</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
          </div>

          {/* Reduction */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="label">Reduction</span>
              <span className="text-[12px] text-[#e63946] font-mono">{state.reductionAmount}px</span>
            </div>
            <input
              type="range" min={0} max={100}
              value={state.reductionAmount}
              onChange={handleReductionChange}
              className="w-full"
            />
          </div>

          {/* Preview Controls */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="label">FPS</span>
                <span className="text-[12px] text-[#e63946] font-mono">{state.previewFps}</span>
              </div>
              <input type="range" min={1} max={60} value={state.previewFps} onChange={handleFpsChange} className="w-full" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="label">Zoom</span>
                <span className="text-[12px] text-[#e63946] font-mono">{state.previewZoom}%</span>
              </div>
              <input type="range" min={100} max={400} value={state.previewZoom} onChange={handleZoomChange} className="w-full" />
            </div>
          </div>

          {/* Background */}
          <div>
            <span className="label block mb-2">Preview Background</span>
            <div className="flex gap-2">
              {BG_COLORS.map((bg) => (
                <button
                  key={bg.value}
                  onClick={() => handleBgColorChange(bg.value)}
                  className={`w-7 h-7 rounded-lg border-2 transition-all ${
                    state.previewBgColor === bg.value ? 'border-[#e63946] scale-110 shadow-[0_0_8px_rgba(124,108,240,0.3)]' : 'border-[rgba(255,255,255,0.08)]'
                  }`}
                  style={{ backgroundColor: bg.value }}
                  title={bg.name}
                />
              ))}
            </div>
          </div>

          {/* Preview Canvas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="label">Crop Preview</span>
              <button
                onClick={() => { frameIndexRef.current = 0; setIsAnimating(!isAnimating); }}
                className="btn-secondary text-[11px]"
              >
                {isAnimating ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                    Play
                  </>
                )}
              </button>
            </div>
            <div
              className="rounded-xl overflow-hidden flex items-center justify-center p-4 min-h-[180px] border border-[rgba(255,255,255,0.06)]"
              style={{ backgroundColor: state.previewBgColor }}
            >
              <canvas
                ref={previewCanvasRef}
                className="max-w-full max-h-[280px]"
                style={{
                  transform: `scale(${state.previewZoom / 100})`,
                  imageRendering: 'pixelated',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
