"use client";

import { useCallback, useRef, useState } from "react";
import { useImport } from "../../context/ImportContext";
import { getBaseName, loadImagesAsFrames } from "../../utils/videoUtils";
import { FRAME_SIZE } from "../../config/animation-types";

const ACCEPTED_TYPES = {
  video: ["video/mp4", "video/webm", "video/quicktime"],
  image: ["image/png", "image/jpeg", "image/webp"],
};

function getMediaType(file: File): "video" | "image" | null {
  if (ACCEPTED_TYPES.video.some((t) => file.type === t)) return "video";
  if (ACCEPTED_TYPES.image.some((t) => file.type === t)) return "image";
  return null;
}

export default function UploadZone() {
  const { dispatch } = useImport();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const mediaType = getMediaType(file);
      console.log("[UploadZone] handleFile called", { name: file.name, type: file.type, size: file.size, mediaType });
      if (!mediaType) {
        console.warn("[UploadZone] Unrecognized media type, returning early");
        return;
      }

      console.log("[UploadZone] Dispatching SET_MEDIA_FILE");
      dispatch({
        type: "SET_MEDIA_FILE",
        file,
        mediaType,
        baseName: getBaseName(file),
      });

      // For images, load frames immediately in the same event handler
      if (mediaType === "image") {
        console.log("[UploadZone] Image detected, dispatching SET_PROCESSING");
        dispatch({
          type: "SET_PROCESSING",
          isProcessing: true,
          message: "Loading image...",
        });

        console.log("[UploadZone] Calling loadImagesAsFrames...");
        loadImagesAsFrames([file])
          .then((frames) => {
            console.log("[UploadZone] loadImagesAsFrames resolved, frame count:", frames.length, frames.map(f => ({ w: f.width, h: f.height })));
            dispatch({ type: "SET_EXTRACTED_FRAMES", frames });
            console.log("[UploadZone] SET_EXTRACTED_FRAMES dispatched");
          })
          .catch((err) => {
            console.error("[UploadZone] loadImagesAsFrames ERROR:", err);
          })
          .finally(() => {
            console.log("[UploadZone] loadImagesAsFrames finally block");
            dispatch({ type: "SET_PROCESSING", isProcessing: false });
          });
      }
    },
    [dispatch]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragOver(false), []);

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      className={`
        flex flex-col items-center justify-center gap-3 p-10
        border-2 border-dashed rounded-xl cursor-pointer
        transition-all duration-200
        ${
          isDragOver
            ? "border-fal-purple-light bg-fal-purple-deep/10"
            : "border-stroke hover:border-stroke-hover hover:bg-surface-tertiary/50"
        }
      `}
    >
      <svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-content-tertiary"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>

      <div className="text-center">
        <p className="text-sm text-content-primary font-medium">
          Drop a video or image here
        </p>
        <p className="text-xs text-content-tertiary mt-1">
          MP4, WebM, MOV, PNG, JPG, WebP
        </p>
        <p className="text-[10px] text-fal-cyan/80 mt-1">
          Game frames: {FRAME_SIZE.width}x{FRAME_SIZE.height}px
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".mp4,.webm,.mov,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
