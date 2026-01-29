"use client";

import { useCallback, useState } from 'react';
import { useSpriteProcessor } from '../context/SpriteProcessorContext';
import { applyChromaKey } from '@/app/utils/chromaKey';
import { applyHaloRemover } from '@/app/utils/haloRemover';
import { calculateCropParameters, applyCropToCanvas, applyCenterCenterCrop } from '@/app/utils/cropUtils';
import { exportSpriteSheet, exportAsZip } from '../utils/exportUtils';
import { FRAME_SIZE } from '@/app/config/animation-types';

export function ExportButtons() {
  const { state, dispatch } = useSpriteProcessor();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const getProcessedCanvases = useCallback(async () => {
    const selectedIndices = Array.from(state.selectedFrames).sort((a, b) => a - b);
    const processedCanvases: HTMLCanvasElement[] = [];

    for (let i = 0; i < selectedIndices.length; i++) {
      const frameIndex = selectedIndices[i];
      const frame = state.extractedFrames[frameIndex];
      if (!frame) continue;

      let canvas = frame.processedCanvas;

      if (state.isChromaKeyApplied) {
        canvas = applyChromaKey(canvas, state.chromaKeyColor, state.chromaKeyTolerance);
      }

      if (state.isHaloRemoverApplied) {
        canvas = await applyHaloRemover(canvas, state.haloExpansion);
      }

      if (state.isCropApplied) {
        if (state.cropMode === 'animation-relative') {
          const firstFrameCanvas = state.extractedFrames[selectedIndices[0]]?.processedCanvas;
          if (firstFrameCanvas) {
            let firstCanvas = firstFrameCanvas;
            if (state.isChromaKeyApplied) {
              firstCanvas = applyChromaKey(firstCanvas, state.chromaKeyColor, state.chromaKeyTolerance);
            }
            const cropParams = calculateCropParameters(
              firstCanvas, state.canvasSize, state.reductionAmount, state.cropAlignX, state.cropAlignY
            );
            canvas = applyCropToCanvas(canvas, cropParams, state.cropAlignX, state.cropAlignY);
          }
        } else {
          canvas = applyCenterCenterCrop(canvas, state.canvasSize, state.reductionAmount, state.cropAlignX, state.cropAlignY);
        }
      }

      processedCanvases.push(canvas);
      setExportProgress(Math.round((i / selectedIndices.length) * 50));
    }

    return processedCanvases;
  }, [state]);

  const handleExportSpriteSheet = useCallback(async () => {
    if (state.selectedFrames.size === 0) {
      alert('Please select frames to export');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: true, message: 'Creating sprite sheet...', progress: 0 } });

    try {
      const canvases = await getProcessedCanvases();
      setExportProgress(75);
      const baseName = state.sourceBaseName || 'sprite';
      exportSpriteSheet(canvases, baseName);
      setExportProgress(100);
      dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: false, message: 'Export complete!', progress: 100 } });
    } catch (error) {
      console.error('Error exporting sprite sheet:', error);
      alert('Error creating sprite sheet: ' + (error as Error).message);
      dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: false, message: '', progress: 0 } });
    } finally {
      setIsExporting(false);
    }
  }, [state, getProcessedCanvases, dispatch]);

  const handleExportZip = useCallback(async () => {
    if (state.selectedFrames.size === 0) {
      alert('Please select frames to export');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: true, message: 'Creating ZIP file...', progress: 0 } });

    try {
      const canvases = await getProcessedCanvases();
      setExportProgress(50);
      const baseName = state.sourceBaseName || 'frame';
      await exportAsZip(canvases, baseName, (progress) => {
        setExportProgress(50 + Math.round(progress * 0.5));
      });
      setExportProgress(100);
      dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: false, message: 'Export complete!', progress: 100 } });
    } catch (error) {
      console.error('Error exporting ZIP:', error);
      alert('Error creating ZIP: ' + (error as Error).message);
      dispatch({ type: 'SET_PROCESSING', payload: { isProcessing: false, message: '', progress: 0 } });
    } finally {
      setIsExporting(false);
    }
  }, [state, getProcessedCanvases, dispatch]);

  if (state.extractedFrames.length === 0) return null;

  return (
    <div className="mt-2 pt-4 border-t border-[rgba(255,255,255,0.04)]">
      <div className="flex items-center gap-3 mb-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffb347" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span className="text-[15px] font-bold text-[#e4e4e7]">Export</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={handleExportSpriteSheet}
          disabled={isExporting || state.selectedFrames.size === 0}
          className="btn-primary py-3 text-[13px]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="2" width="8" height="8" rx="1" />
            <rect x="14" y="2" width="8" height="8" rx="1" />
            <rect x="2" y="14" width="8" height="8" rx="1" />
            <rect x="14" y="14" width="8" height="8" rx="1" />
          </svg>
          {isExporting ? 'Processing...' : 'Sprite Sheet'}
        </button>

        <button
          onClick={handleExportZip}
          disabled={isExporting || state.selectedFrames.size === 0}
          className="btn-primary py-3 text-[13px]"
          style={{ background: 'linear-gradient(135deg, #ffb347 0%, #e09520 100%)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {isExporting ? 'Processing...' : 'ZIP Archive'}
        </button>
      </div>

      {isExporting && (
        <div className="mt-3">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${exportProgress}%` }} />
          </div>
          <p className="text-[#52525b] text-[11px] mt-1.5 text-center font-mono">{exportProgress}%</p>
        </div>
      )}

      {/* Status summary */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <span className="text-[11px] text-[#52525b] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 rounded-md border border-[rgba(255,255,255,0.05)]">
          {state.selectedFrames.size} frame{state.selectedFrames.size !== 1 ? 's' : ''}
        </span>
        {state.isChromaKeyApplied && (
          <span className="text-[10px] text-[#e63946] bg-[rgba(124,108,240,0.08)] px-2 py-0.5 rounded-md border border-[rgba(124,108,240,0.12)]">
            Chroma key
          </span>
        )}
        {state.isHaloRemoverApplied && (
          <span className="text-[10px] text-[#e63946] bg-[rgba(124,108,240,0.08)] px-2 py-0.5 rounded-md border border-[rgba(124,108,240,0.12)]">
            Halo removal
          </span>
        )}
        {state.isCropApplied && (
          <span className="text-[10px] text-[#e63946] bg-[rgba(124,108,240,0.08)] px-2 py-0.5 rounded-md border border-[rgba(124,108,240,0.12)]">
            {typeof state.canvasSize === 'number' ? `${state.canvasSize}px` : `${state.canvasSize.width}x${state.canvasSize.height}`}
          </span>
        )}
        {state.isCropApplied && typeof state.canvasSize === 'object'
          && state.canvasSize.width === FRAME_SIZE.width
          && state.canvasSize.height === FRAME_SIZE.height && (
          <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md border border-green-500/20">
            Game-ready
          </span>
        )}
      </div>
    </div>
  );
}
