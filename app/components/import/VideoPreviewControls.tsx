"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useImport } from "../../context/ImportContext";
import { loadVideo, extractFrames } from "../../utils/videoUtils";

export default function VideoPreviewControls() {
  const { state, dispatch } = useImport();
  const { currentMediaFile, videoFPS } = state;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [duration, setDuration] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [startFrame, setStartFrame] = useState(0);
  const [endFrame, setEndFrame] = useState(0);
  const [frameInterval, setFrameInterval] = useState(1);
  const [isExtracting, setIsExtracting] = useState(false);

  // Load video metadata
  useEffect(() => {
    if (!currentMediaFile) return;

    loadVideo(currentMediaFile).then(({ video, fps, duration: dur }) => {
      videoRef.current = video;
      dispatch({ type: "SET_VIDEO_FPS", fps });
      setDuration(dur);
      const frames = Math.floor(dur * fps);
      setTotalFrames(frames);
      setEndFrame(Math.max(0, frames - 1));

      // Draw first frame
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d")!;
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
        video.currentTime = 0;
        video.onseeked = () => {
          ctx.drawImage(video, 0, 0);
          video.onseeked = null;
        };
      }
    });
  }, [currentMediaFile, dispatch]);

  const handleExtract = useCallback(async () => {
    if (!videoRef.current) return;
    setIsExtracting(true);
    dispatch({
      type: "SET_PROCESSING",
      isProcessing: true,
      message: "Extracting frames...",
      progress: 0,
    });

    try {
      const frames = await extractFrames(
        videoRef.current,
        startFrame,
        endFrame,
        frameInterval,
        videoFPS,
        (p) =>
          dispatch({
            type: "SET_PROCESSING",
            isProcessing: true,
            message: "Extracting frames...",
            progress: p,
          })
      );

      dispatch({ type: "SET_EXTRACTED_FRAMES", frames });
    } finally {
      dispatch({ type: "SET_PROCESSING", isProcessing: false });
      setIsExtracting(false);
    }
  }, [startFrame, endFrame, frameInterval, videoFPS, dispatch]);

  const expectedCount = Math.floor((endFrame - startFrame) / frameInterval) + 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Preview */}
      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-[240px] rounded-lg border border-stroke/50 bg-surface-primary"
        />
      </div>

      {/* FPS + Duration */}
      <div className="flex gap-4 text-xs text-content-secondary">
        <span>FPS: {videoFPS}</span>
        <span>Duration: {duration.toFixed(2)}s</span>
        <span>Total frames: {totalFrames}</span>
      </div>

      {/* Frame range */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-content-tertiary">Start frame</span>
          <input
            type="number"
            min={0}
            max={endFrame}
            value={startFrame}
            onChange={(e) => setStartFrame(Math.max(0, +e.target.value))}
            className="px-3 py-1.5 rounded-md bg-surface-tertiary border border-stroke text-sm text-content-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-content-tertiary">End frame</span>
          <input
            type="number"
            min={startFrame}
            max={totalFrames - 1}
            value={endFrame}
            onChange={(e) =>
              setEndFrame(Math.min(totalFrames - 1, +e.target.value))
            }
            className="px-3 py-1.5 rounded-md bg-surface-tertiary border border-stroke text-sm text-content-primary"
          />
        </label>
      </div>

      {/* Interval */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-content-tertiary">
          Every Nth frame: {frameInterval}
        </span>
        <input
          type="range"
          min={1}
          max={Math.max(1, Math.floor((endFrame - startFrame) / 2))}
          value={frameInterval}
          onChange={(e) => setFrameInterval(+e.target.value)}
          className="accent-fal-purple-deep"
        />
      </label>

      <p className="text-xs text-content-secondary">
        Will extract <strong className="text-content-primary">{expectedCount}</strong> frames
      </p>

      {/* Extract button */}
      <button
        onClick={handleExtract}
        disabled={isExtracting}
        className="px-5 py-2.5 rounded-md font-medium text-sm bg-fal-purple-deep text-white hover:bg-fal-purple-deep/80 disabled:opacity-50 transition-colors"
      >
        {isExtracting ? "Extracting..." : "Extract Frames"}
      </button>
    </div>
  );
}
