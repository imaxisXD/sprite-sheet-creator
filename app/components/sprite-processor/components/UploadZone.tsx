"use client";

import { useCallback, useRef, useState } from 'react';
import { useSpriteProcessor } from '../context/SpriteProcessorContext';
import { getBaseName, loadImagesAsFrames } from '@/app/utils/videoUtils';
import type { MediaType } from '@/app/types';
import { FRAME_SIZE } from '@/app/config/animation-types';

const ACCEPTED_TYPES = {
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  image: ['image/png', 'image/jpeg', 'image/webp'],
};

function getMediaType(file: File): MediaType {
  if (ACCEPTED_TYPES.video.some((type) => file.type.startsWith(type.split('/')[0]))) {
    return 'video';
  }
  if (ACCEPTED_TYPES.image.some((type) => file.type.startsWith(type.split('/')[0]))) {
    return 'image';
  }
  return null;
}

export function UploadZone() {
  const { dispatch } = useSpriteProcessor();
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];
      const mediaType = getMediaType(file);

      if (!mediaType) {
        alert('Please upload a video (MP4, WebM, MOV) or image (PNG, JPG, WebP)');
        return;
      }

      dispatch({
        type: 'SET_MEDIA_FILE',
        payload: {
          file,
          mediaType,
          baseName: getBaseName(file),
        },
      });

      // For images, load frames immediately in the same event handler
      if (mediaType === 'image') {
        dispatch({
          type: 'SET_PROCESSING',
          payload: { isProcessing: true, message: 'Loading images...', progress: 0 },
        });

        loadImagesAsFrames([file], (progress, message) => {
          dispatch({
            type: 'SET_PROCESSING',
            payload: { isProcessing: true, message, progress },
          });
        })
          .then((frames) => {
            dispatch({ type: 'SET_EXTRACTED_FRAMES', payload: frames });
            dispatch({
              type: 'SET_PROCESSING',
              payload: { isProcessing: false, message: '', progress: 100 },
            });
          })
          .catch((err) => {
            console.error('Error loading images:', err);
            dispatch({
              type: 'SET_PROCESSING',
              payload: { isProcessing: false, message: 'Error loading images', progress: 0 },
            });
          });
      }
    },
    [dispatch]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles]
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        onChange={handleInputChange}
        className="hidden"
      />

      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative group rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden
          ${isDragOver ? 'scale-[1.01]' : 'hover:scale-[1.005]'}
        `}
      >
        {/* Static gradient border */}
        <div
          className={`
            absolute inset-0 rounded-2xl p-px transition-opacity duration-300
            ${isDragOver ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
          `}
          style={{
            background: 'linear-gradient(135deg, #e63946, #f4727a, #ffb347)',
          }}
        />

        {/* Inner content */}
        <div
          className={`
            relative m-px rounded-2xl py-16 px-8 text-center transition-all duration-300
            ${isDragOver
              ? 'bg-[rgba(124,108,240,0.08)]'
              : 'bg-[rgba(255,255,255,0.015)]'
            }
          `}
          style={{
            border: isDragOver ? 'none' : '1px dashed rgba(255,255,255,0.1)',
          }}
        >
          {/* Floating icon */}
          <div
            className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-gradient-to-br from-[rgba(124,108,240,0.15)] to-[rgba(124,108,240,0.05)] flex items-center justify-center"
            style={{ animation: 'float 3s ease-in-out infinite' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e63946" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <div className="text-[17px] text-[#e4e4e7] mb-2 font-semibold">
            Drop your video or images here
          </div>
          <div className="text-sm text-[#52525b] mb-6">
            or click to browse files
          </div>

          {/* File type pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {['MP4', 'WebM', 'MOV', 'PNG', 'JPG', 'WebP'].map((type) => (
              <span
                key={type}
                className="text-[11px] font-mono text-[#52525b] px-2.5 py-1 rounded-md bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.05)]"
              >
                {type}
              </span>
            ))}
          </div>

          <div className="mt-3 text-[11px] text-[#e63946]/70 font-mono">
            Game target: {FRAME_SIZE.width}x{FRAME_SIZE.height}px per frame
          </div>
        </div>
      </div>

    </>
  );
}
