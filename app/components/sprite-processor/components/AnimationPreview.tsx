"use client";

import { useCallback, useEffect, useRef } from 'react';
import { useSpriteProcessor } from '../context/SpriteProcessorContext';

export function AnimationPreview() {
  const { state, dispatch } = useSpriteProcessor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const frameIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);

  // Get selected frames in order
  const selectedIndices = Array.from(state.selectedFrames).sort((a, b) => a - b);
  const selectedFrames = selectedIndices.map((i) => state.extractedFrames[i]).filter(Boolean);

  // Animation loop
  useEffect(() => {
    if (!state.isPlaying || selectedFrames.length === 0 || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const frameInterval = 1000 / state.previewFps;

    const animate = (timestamp: number) => {
      if (timestamp - lastFrameTimeRef.current >= frameInterval) {
        lastFrameTimeRef.current = timestamp;

        const frame = selectedFrames[frameIndexRef.current];
        if (frame) {
          // Set canvas size
          canvas.width = frame.processedCanvas.width;
          canvas.height = frame.processedCanvas.height;

          // Clear and draw
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(frame.processedCanvas, 0, 0);
        }

        // Move to next frame
        frameIndexRef.current = (frameIndexRef.current + 1) % selectedFrames.length;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state.isPlaying, selectedFrames, state.previewFps]);

  // Draw first frame when not playing
  useEffect(() => {
    if (state.isPlaying || selectedFrames.length === 0 || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const frame = selectedFrames[0];

    if (frame) {
      canvas.width = frame.processedCanvas.width;
      canvas.height = frame.processedCanvas.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frame.processedCanvas, 0, 0);
    }
  }, [state.isPlaying, selectedFrames]);

  const handlePlayPause = useCallback(() => {
    frameIndexRef.current = 0;
    lastFrameTimeRef.current = 0;
    dispatch({ type: 'SET_IS_PLAYING', payload: !state.isPlaying });
  }, [state.isPlaying, dispatch]);

  const handleFpsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: 'SET_PREVIEW_SETTINGS',
        payload: { previewFps: parseInt(e.target.value) },
      });
    },
    [dispatch]
  );

  if (state.extractedFrames.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 animate-fade-in">
      <span className="label block mb-4">Animation Preview</span>

      {/* Preview Canvas with glow */}
      <div className="relative">
        <div
          className="bg-checkerboard rounded-2xl p-6 flex items-center justify-center min-h-[200px] glow-ichigo"
          style={{ backgroundColor: state.previewBgColor }}
        >
          {selectedFrames.length > 0 ? (
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[280px] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <p className="text-[#3f3f46] text-[13px]">Select frames to preview animation</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mt-4">
        <button
          onClick={handlePlayPause}
          className="btn-primary"
          disabled={selectedFrames.length === 0}
        >
          {state.isPlaying ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              Pause
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              Play
            </>
          )}
        </button>

        <div className="flex items-center gap-2 flex-1">
          <span className="text-[#52525b] text-[12px]">Speed</span>
          <input
            type="range"
            min={1}
            max={60}
            value={state.previewFps}
            onChange={handleFpsChange}
            className="flex-1 max-w-[160px]"
          />
          <span className="text-[#e63946] font-semibold text-[12px] font-mono w-14">
            {state.previewFps} FPS
          </span>
        </div>
      </div>
    </div>
  );
}
