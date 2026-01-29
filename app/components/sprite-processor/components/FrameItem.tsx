"use client";

import { useEffect, useRef } from 'react';
import type { ExtractedFrame } from '@/app/types';
import { FRAME_SIZE } from '@/app/config/animation-types';

interface FrameItemProps {
  frame: ExtractedFrame;
  isSelected: boolean;
  zoom: number;
  onClick: (e: React.MouseEvent) => void;
}

export function FrameItem({ frame, isSelected, zoom, onClick }: FrameItemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const sourceCanvas = frame.processedCanvas;

    // Set canvas size based on zoom
    const size = zoom;
    canvas.width = size;
    canvas.height = size;

    // Calculate scale to fit
    const scale = Math.min(size / sourceCanvas.width, size / sourceCanvas.height);
    const scaledWidth = sourceCanvas.width * scale;
    const scaledHeight = sourceCanvas.height * scale;
    const offsetX = (size - scaledWidth) / 2;
    const offsetY = (size - scaledHeight) / 2;

    // Clear and draw
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(sourceCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
  }, [frame.processedCanvas, zoom]);

  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer rounded-xl overflow-hidden transition-all duration-200 group
        ${isSelected
          ? 'ring-2 ring-[#e63946] ring-offset-2 ring-offset-[#09090b] shadow-[0_0_16px_rgba(124,108,240,0.2)]'
          : 'hover:ring-1 hover:ring-[rgba(255,255,255,0.12)] ring-offset-1 ring-offset-[#09090b]'
        }
      `}
    >
      {/* Checkerboard background */}
      <div className="bg-checkerboard" style={{ width: zoom, height: zoom }}>
        <canvas ref={canvasRef} className="block" />
      </div>

      {/* Frame number badge */}
      <div className="absolute top-1.5 left-1.5 bg-black/60 backdrop-blur-sm text-[#a1a1aa] text-[10px] font-mono px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
        {frame.index + 1}
      </div>

      {/* Dimension badge */}
      <div
        className={`absolute bottom-1.5 right-1.5 text-[9px] font-mono px-1 py-0.5 rounded-md bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity ${
          frame.processedCanvas.width === FRAME_SIZE.width &&
          frame.processedCanvas.height === FRAME_SIZE.height
            ? 'text-green-400'
            : 'text-yellow-400/80'
        }`}
      >
        {frame.processedCanvas.width}x{frame.processedCanvas.height}
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-[#e63946] rounded-md flex items-center justify-center shadow-[0_0_8px_rgba(124,108,240,0.4)]">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
