"use client";

import { useCallback, useEffect, useState } from 'react';
import { useSpriteProcessor } from '../context/SpriteProcessorContext';
import { processFramesBackground, preloadBackgroundRemovalModel } from '@/app/utils/imageProcessing';
import type { BackgroundModel } from '@/app/types';

function checkWebGPUSupport(): boolean {
  return 'gpu' in navigator;
}

export function BackgroundRemovalPanel() {
  const { state, dispatch } = useSpriteProcessor();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [hasWebGPU] = useState(() => checkWebGPUSupport());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (state.backgroundModel === 'imgly' && !isModelReady && !isPreloading) {
      setIsPreloading(true);
      preloadBackgroundRemovalModel()
        .then(() => setIsModelReady(true))
        .catch(console.error)
        .finally(() => setIsPreloading(false));
    }
  }, [state.backgroundModel, isModelReady, isPreloading]);

  const handleModelChange = useCallback(
    (model: BackgroundModel) => {
      dispatch({ type: 'SET_BACKGROUND_MODEL', payload: model });
    },
    [dispatch]
  );

  const handleApplyBackgroundRemoval = useCallback(async () => {
    if (state.extractedFrames.length === 0 || state.backgroundModel === 'none') return;

    setIsProcessing(true);
    dispatch({
      type: 'SET_PROCESSING',
      payload: { isProcessing: true, message: 'Removing backgrounds...', progress: 0 },
    });

    try {
      const processedFrames = await processFramesBackground(
        state.extractedFrames,
        state.backgroundModel,
        (progress, message) => {
          dispatch({
            type: 'SET_PROCESSING',
            payload: { isProcessing: true, message, progress },
          });
        }
      );

      dispatch({ type: 'SET_EXTRACTED_FRAMES', payload: processedFrames });
      dispatch({
        type: 'SET_PROCESSING',
        payload: { isProcessing: false, message: 'Background removal complete!', progress: 100 },
      });
    } catch (error) {
      console.error('Error removing backgrounds:', error);
      dispatch({
        type: 'SET_PROCESSING',
        payload: { isProcessing: false, message: 'Error removing backgrounds', progress: 0 },
      });
    } finally {
      setIsProcessing(false);
    }
  }, [state.extractedFrames, state.backgroundModel, dispatch]);

  if (state.extractedFrames.length === 0) {
    return null;
  }

  return (
    <div className="accordion-section">
      <div className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[rgba(124,108,240,0.2)] to-[rgba(124,108,240,0.05)] flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e63946" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          </div>
          <span className="text-[14px] font-semibold text-[#d4d4d8]">AI Background Removal</span>
          <span className="text-[10px] text-[#52525b] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 rounded-full border border-[rgba(255,255,255,0.05)]">Optional</span>
        </div>
        <svg className={`accordion-chevron ${isOpen ? 'open' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </div>

      <div className={`accordion-content ${isOpen ? 'expanded' : 'collapsed'}`}>
        <div className="px-5 pb-5">
          <p className="text-[12px] text-[#52525b] mb-4 leading-relaxed">
            Use AI to automatically remove backgrounds. Works best with clear subjects.
          </p>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => handleModelChange('none')}
              className={`btn-toggle flex-1 ${state.backgroundModel === 'none' ? 'active' : ''}`}
            >
              None
            </button>
            <button
              onClick={() => handleModelChange('imgly')}
              className={`btn-toggle flex-1 ${state.backgroundModel === 'imgly' ? 'active' : ''}`}
            >
              ImgLy (AI)
            </button>
          </div>

          {state.backgroundModel === 'imgly' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                {hasWebGPU ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[rgba(6,214,160,0.08)] text-[#ffb347] text-[11px] rounded-full border border-[rgba(6,214,160,0.15)]">
                    <span className="w-1.5 h-1.5 bg-[#ffb347] rounded-full animate-pulse" />
                    WebGPU Accelerated
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[rgba(234,179,8,0.08)] text-[#eab308] text-[11px] rounded-full border border-[rgba(234,179,8,0.15)]">
                    <span className="w-1.5 h-1.5 bg-[#eab308] rounded-full" />
                    WASM Fallback
                  </span>
                )}
              </div>

              {isPreloading && (
                <div className="flex items-center gap-2 mb-3 p-2.5 bg-[rgba(124,108,240,0.06)] rounded-lg border border-[rgba(124,108,240,0.1)]">
                  <div className="w-3.5 h-3.5 border-2 border-[#e63946] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[11px] text-[#f4727a]">Loading AI model...</span>
                </div>
              )}

              {isModelReady && !isPreloading && (
                <div className="flex items-center gap-2 mb-3 p-2.5 bg-[rgba(6,214,160,0.06)] rounded-lg border border-[rgba(6,214,160,0.1)]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffb347" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  <span className="text-[11px] text-[#ffb347]">Model ready</span>
                </div>
              )}

              <button
                onClick={handleApplyBackgroundRemoval}
                disabled={isProcessing || isPreloading}
                className="w-full btn-primary"
              >
                {isProcessing ? 'Processing...' : isPreloading ? 'Loading Model...' : 'Apply Background Removal'}
              </button>
            </div>
          )}

          {state.isProcessing && (
            <div className="mt-4 p-4 bg-[rgba(0,0,0,0.2)] rounded-xl text-center">
              <div className="spinner" />
              <p className="text-[#ffb3b3] font-medium text-[13px] mb-3">{state.processingMessage}</p>
              <div className="progress-bar max-w-xs mx-auto">
                <div className="progress-fill" style={{ width: `${state.processingProgress}%` }} />
              </div>
              <p className="text-[#52525b] text-[11px] mt-2 font-mono">{state.processingProgress}%</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
