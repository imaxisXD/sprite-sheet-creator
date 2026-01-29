"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpriteProcessor } from '../context/SpriteProcessorContext';
import { applyChromaKey, getColorAtPosition } from '@/app/utils/chromaKey';

export function ChromaKeyPanel() {
  const { state, dispatch } = useSpriteProcessor();
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isEyedropperActive, setIsEyedropperActive] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

  const firstFrame = state.extractedFrames[0];

  useEffect(() => {
    if (!previewCanvasRef.current || !firstFrame) return;

    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d')!;

    if (state.isChromaKeyApplied) {
      const chromaKeyedCanvas = applyChromaKey(
        firstFrame.processedCanvas,
        state.chromaKeyColor,
        state.chromaKeyTolerance
      );
      canvas.width = chromaKeyedCanvas.width;
      canvas.height = chromaKeyedCanvas.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(chromaKeyedCanvas, 0, 0);
    } else {
      canvas.width = firstFrame.processedCanvas.width;
      canvas.height = firstFrame.processedCanvas.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(firstFrame.processedCanvas, 0, 0);
    }
  }, [firstFrame, state.isChromaKeyApplied, state.chromaKeyColor, state.chromaKeyTolerance]);

  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: 'SET_CHROMA_KEY',
        payload: { applied: state.isChromaKeyApplied, color: e.target.value },
      });
    },
    [state.isChromaKeyApplied, dispatch]
  );

  const handleToleranceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: 'SET_CHROMA_KEY',
        payload: { applied: state.isChromaKeyApplied, tolerance: parseInt(e.target.value) },
      });
    },
    [state.isChromaKeyApplied, dispatch]
  );

  const handleEyedropperClick = useCallback(() => {
    setIsEyedropperActive(!isEyedropperActive);
  }, [isEyedropperActive]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isEyedropperActive || !firstFrame || !previewCanvasRef.current) return;

      const canvas = previewCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = Math.floor((e.clientX - rect.left) * scaleX);
      const y = Math.floor((e.clientY - rect.top) * scaleY);

      const color = getColorAtPosition(firstFrame.processedCanvas, x, y);

      dispatch({
        type: 'SET_CHROMA_KEY',
        payload: { applied: true, color },
      });

      setIsEyedropperActive(false);
    },
    [isEyedropperActive, firstFrame, dispatch]
  );

  const handleCancelChromaKey = useCallback(() => {
    dispatch({
      type: 'SET_CHROMA_KEY',
      payload: { applied: false },
    });
    setIsEyedropperActive(false);
  }, [dispatch]);

  if (state.extractedFrames.length === 0) {
    return null;
  }

  return (
    <div className="accordion-section">
      <div className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-3">
          <div className="step-badge text-[11px]">1</div>
          <span className="text-[14px] font-semibold text-[#d4d4d8]">Chroma Key</span>
          {state.isChromaKeyApplied && (
            <span className="text-[10px] text-[#ffb347] bg-[rgba(6,214,160,0.08)] px-2 py-0.5 rounded-full border border-[rgba(6,214,160,0.15)]">Active</span>
          )}
        </div>
        <svg className={`accordion-chevron ${isOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </div>

      <div className={`accordion-content ${isOpen ? 'expanded' : 'collapsed'}`}>
        <div className="px-5 pb-5">
          <p className="text-[12px] text-[#52525b] mb-4 leading-relaxed">
            Remove a specific color from your frames. Great for green/blue screens or solid backgrounds.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Controls */}
            <div className="space-y-4">
              {/* Target Color */}
              <div>
                <span className="label block mb-2">Target Color</span>
                <div className="flex gap-2 items-center">
                  <div
                    className="w-10 h-10 rounded-xl border border-[rgba(255,255,255,0.1)]"
                    style={{ backgroundColor: state.chromaKeyColor }}
                  />
                  <input
                    type="text"
                    value={state.chromaKeyColor}
                    onChange={handleColorChange}
                    maxLength={7}
                    className="flex-1 font-mono"
                  />
                </div>

                <button
                  onClick={handleEyedropperClick}
                  className={`w-full mt-2 btn-secondary text-[12px] ${isEyedropperActive ? '!border-[rgba(124,108,240,0.5)] !text-[#ffb3b3] !bg-[rgba(124,108,240,0.1)]' : ''}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9" /></svg>
                  {isEyedropperActive ? 'Click preview to pick' : 'Pick from Preview'}
                </button>

                {isEyedropperActive && (
                  <p className="text-[11px] text-[#f4727a] mt-2 text-center font-medium">
                    Click any color on the preview
                  </p>
                )}
              </div>

              {/* Tolerance */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="label">Tolerance</span>
                  <span className="text-[12px] text-[#e63946] font-mono">{state.chromaKeyTolerance}</span>
                </div>
                <input
                  type="range" min={0} max={150}
                  value={state.chromaKeyTolerance}
                  onChange={handleToleranceChange}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-[#3f3f46] mt-1">
                  <span>Precise</span>
                  <span>Aggressive</span>
                </div>
              </div>

              {state.isChromaKeyApplied && (
                <button onClick={handleCancelChromaKey} className="w-full btn-secondary text-[12px]">
                  Cancel Chroma Key
                </button>
              )}
            </div>

            {/* Preview */}
            <div>
              <span className="label block mb-2 text-center">Preview</span>
              <div
                className="relative w-full aspect-square bg-checkerboard rounded-xl overflow-hidden flex items-center justify-center border border-[rgba(255,255,255,0.06)]"
                style={{ cursor: isEyedropperActive ? 'crosshair' : 'default' }}
              >
                {firstFrame ? (
                  <canvas
                    ref={previewCanvasRef}
                    onClick={handleCanvasClick}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <p className="text-[#3f3f46] text-[12px]">No frames to preview</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
