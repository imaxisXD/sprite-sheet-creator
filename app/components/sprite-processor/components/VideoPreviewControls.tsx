"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSpriteProcessor } from '../context/SpriteProcessorContext';
import { loadVideo, extractFrames, extractFrameAtTime } from '@/app/utils/videoUtils';

export function VideoPreviewControls() {
  const { state, dispatch } = useSpriteProcessor();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoData, setVideoData] = useState<{
    video: HTMLVideoElement;
    fps: number;
    duration: number;
    totalFrames: number;
  } | null>(null);

  const [startFrame, setStartFrame] = useState(0);
  const [endFrame, setEndFrame] = useState(150);
  const [frameInterval, setFrameInterval] = useState(1);

  // Playback state
  const [playbackMode, setPlaybackMode] = useState<'normal' | 'loop' | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Frame preview thumbnails (data URLs)
  const [startFramePreview, setStartFramePreview] = useState<string | null>(null);
  const [endFramePreview, setEndFramePreview] = useState<string | null>(null);

  // Ghost overlay state
  const [showGhostOverlay, setShowGhostOverlay] = useState(false);
  const [ghostOpacity, setGhostOpacity] = useState(0.5);

  // Load video when file changes
  useEffect(() => {
    if (!state.currentMediaFile || state.mediaType !== 'video') return;

    loadVideo(state.currentMediaFile).then((data) => {
      setVideoData(data);
      const totalFrames = Math.floor(data.duration * data.fps);
      setEndFrame(Math.min(150, totalFrames));
      dispatch({ type: 'SET_VIDEO_FPS', payload: data.fps });

      // Set video source for preview
      if (videoRef.current) {
        videoRef.current.src = URL.createObjectURL(state.currentMediaFile!);
      }
    });
  }, [state.currentMediaFile, state.mediaType, dispatch]);

  const totalFramesInRange = Math.max(0, endFrame - startFrame + 1);
  const estimatedExtractFrames = Math.ceil(totalFramesInRange / frameInterval);

  const formatTime = (frame: number, fps: number) => {
    const time = frame / fps;
    return time.toFixed(2) + 's';
  };

  // Helper function to extract frame preview thumbnail
  const extractFramePreview = useCallback(async (frameNumber: number): Promise<string | null> => {
    if (!videoData || !videoData.video) return null;
    const time = frameNumber / videoData.fps;
    const canvas = await extractFrameAtTime(videoData.video, time);
    return canvas.toDataURL('image/png');
  }, [videoData]);

  // Playback handlers
  const handlePlayWholeVideo = useCallback(() => {
    if (!videoRef.current) return;
    setPlaybackMode('normal');
    setIsVideoPlaying(true);
    videoRef.current.currentTime = 0;
    videoRef.current.play();
  }, []);

  const handlePlayLoop = useCallback(() => {
    if (!videoRef.current || !videoData) return;
    setPlaybackMode('loop');
    setIsVideoPlaying(true);
    const startTime = startFrame / videoData.fps;
    videoRef.current.currentTime = startTime;
    videoRef.current.play();
  }, [videoData, startFrame]);

  const handleStopPlayback = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsVideoPlaying(false);
    setPlaybackMode(null);
  }, []);

  // Effect for loop playback control
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoData) return;

    const handleTimeUpdate = () => {
      if (playbackMode !== 'loop') return;
      const endTime = endFrame / videoData.fps;
      const startTime = startFrame / videoData.fps;
      if (video.currentTime >= endTime) {
        video.currentTime = startTime;
      }
    };

    const handleEnded = () => {
      if (playbackMode === 'normal') {
        setIsVideoPlaying(false);
        setPlaybackMode(null);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoData, startFrame, endFrame, playbackMode]);

  // Extract frame previews when start/end frames change
  useEffect(() => {
    if (!videoData) return;
    extractFramePreview(startFrame).then(setStartFramePreview);
  }, [videoData, startFrame, extractFramePreview]);

  useEffect(() => {
    if (!videoData) return;
    extractFramePreview(endFrame).then(setEndFramePreview);
  }, [videoData, endFrame, extractFramePreview]);

  const handleStartProcessing = useCallback(async () => {
    if (!videoData) return;

    dispatch({
      type: 'SET_PROCESSING',
      payload: { isProcessing: true, message: 'Extracting frames...', progress: 0 },
    });

    try {
      const frames = await extractFrames(
        videoData.video,
        startFrame,
        endFrame,
        frameInterval,
        videoData.fps,
        (progress, message) => {
          dispatch({
            type: 'SET_PROCESSING',
            payload: { isProcessing: true, message, progress },
          });
        }
      );

      dispatch({ type: 'SET_EXTRACTED_FRAMES', payload: frames });
      dispatch({
        type: 'SET_PROCESSING',
        payload: { isProcessing: false, message: '', progress: 100 },
      });
    } catch (error) {
      console.error('Error extracting frames:', error);
      dispatch({
        type: 'SET_PROCESSING',
        payload: { isProcessing: false, message: 'Error extracting frames', progress: 0 },
      });
    }
  }, [videoData, startFrame, endFrame, frameInterval, dispatch]);

  const handleCancel = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  if (!state.currentMediaFile || state.mediaType !== 'video') {
    return null;
  }

  const maxFrame = videoData ? Math.floor(videoData.duration * videoData.fps) : 300;

  return (
    <div className="mt-6 animate-fade-in">
      <div className="section-title mb-5">
        <div className="step-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </div>
        <span>Video Preview</span>
      </div>

      {/* Video Preview */}
      <div className="glass-card-elevated p-5 mb-5">
        <video
          ref={videoRef}
          muted
          playsInline
          className="w-full max-h-[400px] rounded-xl bg-black/50"
        />

        {/* Playback Controls */}
        <div className="flex items-center gap-3 mt-4">
          {!isVideoPlaying ? (
            <>
              <button
                onClick={handlePlayWholeVideo}
                className="btn-secondary"
                disabled={!videoData}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                Play Video
              </button>
              <button
                onClick={handlePlayLoop}
                className="btn-primary"
                disabled={!videoData}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>
                Loop Range
              </button>
            </>
          ) : (
            <button onClick={handleStopPlayback} className="btn-secondary">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              Stop
            </button>
          )}
          {playbackMode === 'loop' && isVideoPlaying && (
            <span className="text-[#e63946] text-xs font-medium ml-1">
              Looping frames {startFrame} - {endFrame}
            </span>
          )}
        </div>
      </div>

      {/* Frame Range Preview */}
      {videoData && (
        <div className="glass-card p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <span className="label">Frame Range</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showGhostOverlay}
                onChange={(e) => setShowGhostOverlay(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              <span className="text-[12px] text-[#52525b]">Ghost Overlay</span>
            </label>
          </div>

          {showGhostOverlay ? (
            <div className="flex flex-col items-center">
              <div className="relative w-72 h-72 bg-[#111113] rounded-xl overflow-hidden border border-[rgba(124,108,240,0.3)]">
                {startFramePreview ? (
                  <img src={startFramePreview} alt="Start frame" className="absolute inset-0 w-full h-full object-contain" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[#3f3f46] text-xs">Loading...</div>
                )}
                {endFramePreview && (
                  <img src={endFramePreview} alt="End frame (ghost)" className="absolute inset-0 w-full h-full object-contain" style={{ opacity: ghostOpacity }} />
                )}
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] text-white font-mono">
                  F{startFrame}
                </div>
                <div className="absolute top-2 right-2 bg-[rgba(124,108,240,0.6)] backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] text-white font-mono">
                  F{endFrame}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4 w-72">
                <span className="text-[11px] text-[#52525b]">Opacity</span>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={ghostOpacity}
                  onChange={(e) => setGhostOpacity(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-[11px] text-[#e63946] font-mono w-8">{Math.round(ghostOpacity * 100)}%</span>
              </div>
              <p className="text-[11px] text-[#3f3f46] mt-2 text-center">
                Check if first & last frames align for seamless looping
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-4 justify-center">
              <div className="flex flex-col items-center">
                <div className="relative w-52 h-52 bg-[#111113] rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)]">
                  {startFramePreview ? (
                    <img src={startFramePreview} alt="Start frame" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#3f3f46] text-xs">Loading...</div>
                  )}
                </div>
                <span className="text-[#52525b] text-[11px] mt-2 font-mono">{formatTime(startFrame, videoData.fps)}</span>
                <span className="text-[#e63946] text-[10px] font-semibold uppercase tracking-wider">Start</span>
              </div>

              <div className="flex flex-col items-center text-[#3f3f46] gap-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                <span className="text-[10px] font-mono">{totalFramesInRange}f</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="relative w-52 h-52 bg-[#111113] rounded-xl overflow-hidden border border-[rgba(255,255,255,0.06)]">
                  {endFramePreview ? (
                    <img src={endFramePreview} alt="End frame" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#3f3f46] text-xs">Loading...</div>
                  )}
                </div>
                <span className="text-[#52525b] text-[11px] mt-2 font-mono">{formatTime(endFrame, videoData.fps)}</span>
                <span className="text-[#e63946] text-[10px] font-semibold uppercase tracking-wider">End</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Settings */}
      <div className="glass-card p-5 space-y-5">
        <span className="label block mb-1">Frame Settings</span>

        {/* Start Frame */}
        <div className="flex items-center gap-4">
          <label className="text-[#71717a] text-[13px] w-28 shrink-0 font-medium">Start Frame</label>
          <input
            type="number"
            value={startFrame}
            onChange={(e) => setStartFrame(Math.max(0, parseInt(e.target.value) || 0))}
            min={0}
            max={maxFrame}
            className="w-20"
          />
          <input
            type="range" value={startFrame}
            onChange={(e) => setStartFrame(parseInt(e.target.value))}
            min={0} max={maxFrame}
            className="flex-1"
          />
          <span className="text-[#52525b] text-[12px] font-mono w-14 text-right">
            {videoData ? formatTime(startFrame, videoData.fps) : '0.00s'}
          </span>
        </div>

        {/* End Frame */}
        <div className="flex items-center gap-4">
          <label className="text-[#71717a] text-[13px] w-28 shrink-0 font-medium">End Frame</label>
          <input
            type="number"
            value={endFrame}
            onChange={(e) => setEndFrame(Math.max(startFrame, parseInt(e.target.value) || 0))}
            min={0}
            max={maxFrame}
            className="w-20"
          />
          <input
            type="range" value={endFrame}
            onChange={(e) => setEndFrame(parseInt(e.target.value))}
            min={0} max={maxFrame}
            className="flex-1"
          />
          <span className="text-[#52525b] text-[12px] font-mono w-14 text-right">
            {videoData ? formatTime(endFrame, videoData.fps) : '5.00s'}
          </span>
        </div>

        {/* Frame Interval */}
        <div className="flex items-center gap-4">
          <label className="text-[#71717a] text-[13px] w-28 shrink-0 font-medium">Extract Every</label>
          <input
            type="number"
            value={frameInterval}
            onChange={(e) => setFrameInterval(Math.max(1, parseInt(e.target.value) || 1))}
            min={1} max={30}
            className="w-20"
          />
          <span className="text-[#3f3f46] text-[12px]">
            Nth frame (1 = all, 2 = every other)
          </span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 pt-2 border-t border-[rgba(255,255,255,0.04)]">
          <div>
            <span className="label block mb-1">In Range</span>
            <span className="text-[#ffb3b3] font-semibold text-[15px]">{totalFramesInRange}</span>
          </div>
          <div>
            <span className="label block mb-1">Will Extract</span>
            <span className="text-[#ffb3b3] font-semibold text-[15px]">~{estimatedExtractFrames}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-5">
        <button onClick={handleStartProcessing} className="btn-primary" disabled={state.isProcessing}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          Extract Frames
        </button>
        <button onClick={handleCancel} className="btn-secondary">
          Cancel
        </button>
      </div>

      {/* Processing Overlay */}
      {state.isProcessing && (
        <div className="mt-5 glass-card p-6 text-center">
          <div className="spinner" />
          <p className="text-[#ffb3b3] font-medium text-[14px] mb-3">{state.processingMessage}</p>
          <div className="progress-bar max-w-sm mx-auto">
            <div className="progress-fill" style={{ width: `${state.processingProgress}%` }} />
          </div>
          <p className="text-[#52525b] text-[12px] mt-2 font-mono">{state.processingProgress}%</p>
        </div>
      )}
    </div>
  );
}
