"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpriteProcessor } from '../context/SpriteProcessorContext';
import { applyHaloRemover } from '@/app/utils/haloRemover';
import { applyChromaKey } from '@/app/utils/chromaKey';

const BG_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Gray', value: '#808080' },
  { name: 'White', value: '#ffffff' },
  { name: 'Brown', value: '#8B4513' },
  { name: 'Green', value: '#228B22' },
];

export function HaloRemoverPanel() {
  const { state, dispatch } = useSpriteProcessor();
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [previewBgColor, setPreviewBgColor] = useState('#000000');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const firstFrame = state.extractedFrames[0];

  const getSourceCanvas = useCallback(() => {
    if (!firstFrame) return null;
    if (state.isChromaKeyApplied) {
      return applyChromaKey(firstFrame.processedCanvas, state.chromaKeyColor, state.chromaKeyTolerance);
    }
    return firstFrame.processedCanvas;
  }, [firstFrame, state.isChromaKeyApplied, state.chromaKeyColor, state.chromaKeyTolerance]);

  useEffect(() => {
    const updatePreview = async () => {
      if (!previewCanvasRef.current || !firstFrame) return;

      const canvas = previewCanvasRef.current;
      const ctx = canvas.getContext('2d')!;
      const sourceCanvas = getSourceCanvas();
      if (!sourceCanvas) return;

      if (state.isHaloRemoverApplied) {
        setIsProcessing(true);
        try {
          const haloRemovedCanvas = await applyHaloRemover(sourceCanvas, state.haloExpansion);
          canvas.width = haloRemovedCanvas.width;
          canvas.height = haloRemovedCanvas.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(haloRemovedCanvas, 0, 0);
        } finally {
          setIsProcessing(false);
        }
      } else {
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sourceCanvas, 0, 0);
      }
    };

    updatePreview();
  }, [firstFrame, getSourceCanvas, state.isHaloRemoverApplied, state.haloExpansion]);

  const handleExpansionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: 'SET_HALO_REMOVER',
        payload: { applied: state.isHaloRemoverApplied, expansion: parseInt(e.target.value) },
      });
    },
    [state.isHaloRemoverApplied, dispatch]
  );

  const handleApplyHaloRemover = useCallback(() => {
    dispatch({ type: 'SET_HALO_REMOVER', payload: { applied: true } });
  }, [dispatch]);

  const handleCancelHaloRemover = useCallback(() => {
    dispatch({ type: 'SET_HALO_REMOVER', payload: { applied: false } });
  }, [dispatch]);

  if (state.extractedFrames.length === 0) return null;

  return (
    <div className="accordion-section">
      <div className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-3">
          <div className="step-badge text-[11px]">3</div>
          <span className="text-[14px] font-semibold text-[#d4d4d8]">Halo Remover</span>
          <span className="text-[10px] text-[#52525b] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 rounded-full border border-[rgba(255,255,255,0.05)]">Optional</span>
          {state.isHaloRemoverApplied && (
            <span className="text-[10px] text-[#ffb347] bg-[rgba(6,214,160,0.08)] px-2 py-0.5 rounded-full border border-[rgba(6,214,160,0.15)]">Active</span>
          )}
        </div>
        <svg className={`accordion-chevron ${isOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </div>

      <div className={`accordion-content ${isOpen ? 'expanded' : 'collapsed'}`}>
        <div className="px-5 pb-5">
          <p className="text-[12px] text-[#52525b] mb-4 leading-relaxed">
            Expand transparency outward to clean up edge artifacts and halos around sprites.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Controls */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="label">Expansion</span>
                  <span className="text-[12px] text-[#e63946] font-mono">{state.haloExpansion}px</span>
                </div>
                <input
                  type="range" min={1} max={30}
                  value={state.haloExpansion}
                  onChange={handleExpansionChange}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-[#3f3f46] mt-1">
                  <span>Subtle</span>
                  <span>Aggressive</span>
                </div>

                {state.haloExpansion > 10 && (
                  <p className="text-[11px] text-[#eab308] mt-2 p-2 bg-[rgba(234,179,8,0.06)] rounded-lg border border-[rgba(234,179,8,0.1)]">
                    High values may remove detail from edges.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {!state.isHaloRemoverApplied ? (
                  <button onClick={handleApplyHaloRemover} className="flex-1 btn-primary text-[13px]">
                    Apply
                  </button>
                ) : (
                  <button onClick={handleCancelHaloRemover} className="flex-1 btn-secondary text-[13px]">
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="label">Preview</span>
                <div className="flex gap-1">
                  {BG_COLORS.map((bg) => (
                    <button
                      key={bg.value}
                      onClick={() => setPreviewBgColor(bg.value)}
                      className={`w-5 h-5 rounded-md border transition-all ${
                        previewBgColor === bg.value ? 'border-[#e63946] scale-110' : 'border-[rgba(255,255,255,0.08)]'
                      }`}
                      style={{ backgroundColor: bg.value }}
                      title={bg.name}
                    />
                  ))}
                </div>
              </div>

              <div
                className="relative w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center border border-[rgba(255,255,255,0.06)]"
                style={{ backgroundColor: previewBgColor }}
              >
                {isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="spinner" />
                  </div>
                )}
                {firstFrame ? (
                  <canvas ref={previewCanvasRef} className="max-w-full max-h-full object-contain" />
                ) : (
                  <p className="text-[#3f3f46] text-[12px]">No frames</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
