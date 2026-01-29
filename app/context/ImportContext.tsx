"use client";

import { createContext, useContext, useReducer, type ReactNode } from "react";
import type {
  ExtractedFrame,
  CropMode,
  AlignX,
  AlignY,
  BackgroundModel,
  MediaType,
  CanvasSize,
} from "../types";
import { FRAME_SIZE } from "../config/animation-types";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface ImportState {
  // Media
  currentMediaFile: File | null;
  mediaType: MediaType;
  sourceBaseName: string | null;
  videoFPS: number;

  // Extracted frames
  extractedFrames: ExtractedFrame[];
  selectedFrames: Set<number>;
  lastSelectedIndex: number | null;

  // Processing flags
  isProcessing: boolean;
  processingMessage: string;
  processingProgress: number;

  // Background removal
  backgroundModel: BackgroundModel;

  // Chroma key
  isChromaKeyApplied: boolean;
  chromaKeyColor: string;
  chromaKeyTolerance: number;

  // Halo remover
  isHaloRemoverApplied: boolean;
  haloExpansion: number;

  // Auto-crop
  isCropApplied: boolean;
  cropMode: CropMode;
  canvasSize: CanvasSize;
  reductionAmount: number;
  cropAlignX: AlignX;
  cropAlignY: AlignY;

  // Preview
  previewFps: number;
  previewBgColor: string;
  thumbnailZoom: number;
  isPlaying: boolean;

  // Workflow step within import flow
  currentStep: "upload" | "video-settings" | "frame-selection";
}

const initialState: ImportState = {
  currentMediaFile: null,
  mediaType: null,
  sourceBaseName: null,
  videoFPS: 30,

  extractedFrames: [],
  selectedFrames: new Set(),
  lastSelectedIndex: null,

  isProcessing: false,
  processingMessage: "",
  processingProgress: 0,

  backgroundModel: "none",

  isChromaKeyApplied: false,
  chromaKeyColor: "#00ff00",
  chromaKeyTolerance: 50,

  isHaloRemoverApplied: false,
  haloExpansion: 5,

  isCropApplied: false,
  cropMode: "animation-relative",
  canvasSize: { width: FRAME_SIZE.width, height: FRAME_SIZE.height },
  reductionAmount: 0,
  cropAlignX: "center",
  cropAlignY: "bottom",

  previewFps: 12,
  previewBgColor: "#000000",
  thumbnailZoom: 100,
  isPlaying: true,

  currentStep: "upload",
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type ImportAction =
  | { type: "SET_MEDIA_FILE"; file: File; mediaType: "video" | "image"; baseName: string }
  | { type: "SET_VIDEO_FPS"; fps: number }
  | { type: "SET_EXTRACTED_FRAMES"; frames: ExtractedFrame[] }
  | { type: "TOGGLE_FRAME_SELECTION"; index: number }
  | { type: "SET_FRAME_RANGE_SELECTION"; from: number; to: number; selected: boolean }
  | { type: "SELECT_ALL_FRAMES" }
  | { type: "CLEAR_FRAME_SELECTION" }
  | { type: "SET_LAST_SELECTED_INDEX"; index: number | null }
  | { type: "SET_PROCESSING"; isProcessing: boolean; message?: string; progress?: number }
  | { type: "SET_BACKGROUND_MODEL"; model: BackgroundModel }
  | {
      type: "SET_CHROMA_KEY";
      isApplied?: boolean;
      color?: string;
      tolerance?: number;
    }
  | { type: "SET_HALO_REMOVER"; isApplied?: boolean; expansion?: number }
  | {
      type: "SET_CROP_SETTINGS";
      isApplied?: boolean;
      cropMode?: CropMode;
      canvasSize?: CanvasSize;
      reductionAmount?: number;
      alignX?: AlignX;
      alignY?: AlignY;
    }
  | {
      type: "SET_PREVIEW_SETTINGS";
      fps?: number;
      bgColor?: string;
      zoom?: number;
    }
  | { type: "SET_IS_PLAYING"; isPlaying: boolean }
  | { type: "SET_THUMBNAIL_ZOOM"; zoom: number }
  | { type: "SET_CURRENT_STEP"; step: ImportState["currentStep"] }
  | {
      type: "UPDATE_FRAME_PROCESSED_CANVAS";
      index: number;
      processedCanvas: HTMLCanvasElement;
    }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function importReducer(state: ImportState, action: ImportAction): ImportState {
  console.log("[ImportReducer] action:", action.type, action.type === "SET_EXTRACTED_FRAMES" ? `(${(action as any).frames?.length} frames)` : "");
  switch (action.type) {
    case "SET_MEDIA_FILE":
      console.log("[ImportReducer] SET_MEDIA_FILE -> currentStep:", action.mediaType === "video" ? "video-settings" : "frame-selection");
      return {
        ...initialState,
        currentMediaFile: action.file,
        mediaType: action.mediaType,
        sourceBaseName: action.baseName,
        currentStep: action.mediaType === "video" ? "video-settings" : "frame-selection",
      };

    case "SET_VIDEO_FPS":
      return { ...state, videoFPS: action.fps };

    case "SET_EXTRACTED_FRAMES":
      console.log("[ImportReducer] SET_EXTRACTED_FRAMES -> frames:", action.frames.length, "selectedFrames:", action.frames.map((_, i) => i));
      return {
        ...state,
        extractedFrames: action.frames,
        selectedFrames: new Set(action.frames.map((_, i) => i)),
        lastSelectedIndex: null,
        currentStep: "frame-selection",
      };

    case "TOGGLE_FRAME_SELECTION": {
      const next = new Set(state.selectedFrames);
      if (next.has(action.index)) next.delete(action.index);
      else next.add(action.index);
      return { ...state, selectedFrames: next, lastSelectedIndex: action.index };
    }

    case "SET_FRAME_RANGE_SELECTION": {
      const next = new Set(state.selectedFrames);
      const lo = Math.min(action.from, action.to);
      const hi = Math.max(action.from, action.to);
      for (let i = lo; i <= hi; i++) {
        if (action.selected) next.add(i);
        else next.delete(i);
      }
      return { ...state, selectedFrames: next };
    }

    case "SELECT_ALL_FRAMES":
      return {
        ...state,
        selectedFrames: new Set(state.extractedFrames.map((_, i) => i)),
      };

    case "CLEAR_FRAME_SELECTION":
      return { ...state, selectedFrames: new Set() };

    case "SET_LAST_SELECTED_INDEX":
      return { ...state, lastSelectedIndex: action.index };

    case "SET_PROCESSING":
      return {
        ...state,
        isProcessing: action.isProcessing,
        processingMessage: action.message ?? state.processingMessage,
        processingProgress: action.progress ?? state.processingProgress,
      };

    case "SET_BACKGROUND_MODEL":
      return { ...state, backgroundModel: action.model };

    case "SET_CHROMA_KEY":
      return {
        ...state,
        isChromaKeyApplied: action.isApplied ?? state.isChromaKeyApplied,
        chromaKeyColor: action.color ?? state.chromaKeyColor,
        chromaKeyTolerance: action.tolerance ?? state.chromaKeyTolerance,
      };

    case "SET_HALO_REMOVER":
      return {
        ...state,
        isHaloRemoverApplied: action.isApplied ?? state.isHaloRemoverApplied,
        haloExpansion: action.expansion ?? state.haloExpansion,
      };

    case "SET_CROP_SETTINGS":
      return {
        ...state,
        isCropApplied: action.isApplied ?? state.isCropApplied,
        cropMode: action.cropMode ?? state.cropMode,
        canvasSize: action.canvasSize ?? state.canvasSize,
        reductionAmount: action.reductionAmount ?? state.reductionAmount,
        cropAlignX: action.alignX ?? state.cropAlignX,
        cropAlignY: action.alignY ?? state.cropAlignY,
      };

    case "SET_PREVIEW_SETTINGS":
      return {
        ...state,
        previewFps: action.fps ?? state.previewFps,
        previewBgColor: action.bgColor ?? state.previewBgColor,
        thumbnailZoom: action.zoom ?? state.thumbnailZoom,
      };

    case "SET_IS_PLAYING":
      return { ...state, isPlaying: action.isPlaying };

    case "SET_THUMBNAIL_ZOOM":
      return { ...state, thumbnailZoom: action.zoom };

    case "SET_CURRENT_STEP":
      return { ...state, currentStep: action.step };

    case "UPDATE_FRAME_PROCESSED_CANVAS": {
      const frames = [...state.extractedFrames];
      if (frames[action.index]) {
        frames[action.index] = {
          ...frames[action.index],
          processedCanvas: action.processedCanvas,
        };
      }
      return { ...state, extractedFrames: frames };
    }

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ImportContextValue {
  state: ImportState;
  dispatch: React.Dispatch<ImportAction>;
}

const ImportContext = createContext<ImportContextValue | null>(null);

export function ImportProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(importReducer, initialState);
  return (
    <ImportContext.Provider value={{ state, dispatch }}>
      {children}
    </ImportContext.Provider>
  );
}

export function useImport() {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error("useImport must be used within ImportProvider");
  return ctx;
}
