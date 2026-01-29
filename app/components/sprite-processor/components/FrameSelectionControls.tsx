"use client";

import { useCallback } from 'react';
import { useSpriteProcessor } from '../context/SpriteProcessorContext';

export function FrameSelectionControls() {
  const { dispatch } = useSpriteProcessor();

  const handleSelectAll = useCallback(() => {
    dispatch({ type: 'SELECT_ALL_FRAMES' });
  }, [dispatch]);

  const handleClearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_FRAME_SELECTION' });
  }, [dispatch]);

  return (
    <div className="flex gap-2">
      <button onClick={handleSelectAll} className="btn-secondary text-[12px]">
        Select All
      </button>
      <button onClick={handleClearSelection} className="btn-secondary text-[12px]">
        Clear
      </button>
    </div>
  );
}
