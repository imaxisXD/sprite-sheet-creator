"use client";

import { useCallback } from 'react';
import { useSpriteProcessor } from '../context/SpriteProcessorContext';
import { FrameItem } from './FrameItem';
import { FrameSelectionControls } from './FrameSelectionControls';
import { FRAME_SIZE } from '@/app/config/animation-types';

export function FramesGrid() {
  const { state, dispatch } = useSpriteProcessor();

  const handleFrameClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      if (e.shiftKey && state.lastSelectedIndex !== null) {
        // Shift-click: select range
        const isCurrentlySelected = state.selectedFrames.has(index);
        dispatch({
          type: 'SET_FRAME_RANGE_SELECTION',
          payload: {
            start: state.lastSelectedIndex,
            end: index,
            selected: !isCurrentlySelected,
          },
        });
      } else {
        // Regular click: toggle single frame
        dispatch({ type: 'TOGGLE_FRAME_SELECTION', payload: index });
      }

      dispatch({ type: 'SET_LAST_SELECTED_INDEX', payload: index });
    },
    [state.lastSelectedIndex, state.selectedFrames, dispatch]
  );

  const handleZoomChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch({
        type: 'SET_PREVIEW_SETTINGS',
        payload: { thumbnailZoom: parseInt(e.target.value) },
      });
    },
    [dispatch]
  );

  if (state.extractedFrames.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <span className="section-title">Frames</span>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-[12px] font-mono text-[#52525b] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 rounded-md border border-[rgba(255,255,255,0.05)]">
              {state.extractedFrames.length} total
            </span>
            <span className="text-[12px] font-mono text-[#e63946] bg-[rgba(124,108,240,0.08)] px-2 py-0.5 rounded-md border border-[rgba(124,108,240,0.15)]">
              {state.selectedFrames.size} selected
            </span>
            <span className="text-[11px] font-mono text-[#e63946]/50 bg-[rgba(255,255,255,0.03)] px-2 py-0.5 rounded-md border border-[rgba(255,255,255,0.05)]">
              Target: {FRAME_SIZE.width}x{FRAME_SIZE.height}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Zoom Control */}
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
            <input
              type="range"
              min={60}
              max={400}
              step={20}
              value={state.thumbnailZoom}
              onChange={handleZoomChange}
              className="w-28"
            />
            <span className="text-[11px] text-[#52525b] font-mono w-9">
              {state.thumbnailZoom}%
            </span>
          </div>

          <FrameSelectionControls />
        </div>
      </div>

      {/* Grid */}
      <div
        className="grid gap-2 max-h-[480px] overflow-y-auto p-4 glass-card"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${state.thumbnailZoom}px, 1fr))`,
        }}
      >
        {state.extractedFrames.map((frame) => (
          <FrameItem
            key={frame.index}
            frame={frame}
            isSelected={state.selectedFrames.has(frame.index)}
            zoom={state.thumbnailZoom}
            onClick={(e) => handleFrameClick(frame.index, e)}
          />
        ))}
      </div>

      {/* Hint */}
      <p className="text-[#3f3f46] text-[11px] mt-3 flex items-center gap-1.5">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
        Hold Shift + click to select a range
      </p>
    </div>
  );
}
