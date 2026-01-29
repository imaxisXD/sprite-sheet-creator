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
} from "@/app/types";
import { FRAME_SIZE } from "@/app/config/animation-types";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface SpriteProcessorState {
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
  previewZoom: number;
  previewBgColor: string;
  thumbnailZoom: number;
  isPlaying: boolean;

  // Workflow step within sprite processor flow
  currentStep: "upload" | "video-settings" | "frame-selection";
}

const initialState: SpriteProcessorState = {
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
  cropAlignY: "center",

  previewFps: 12,
  previewZoom: 100,
  previewBgColor: "#000000",
  thumbnailZoom: 100,
  isPlaying: true,

  currentStep: "upload",
};

// ---------------------------------------------------------------------------
// Actions  (payload-style to match sprite-maker component expectations)
// ---------------------------------------------------------------------------

export type SpriteProcessorAction =
  | {
      type: "SET_MEDIA_FILE";
      payload: { file: File; mediaType: "video" | "image"; baseName: string };
    }
  | { type: "SET_VIDEO_FPS"; payload: number }
  | { type: "SET_EXTRACTED_FRAMES"; payload: ExtractedFrame[] }
  | { type: "TOGGLE_FRAME_SELECTION"; payload: number }
  | {
      type: "SET_FRAME_RANGE_SELECTION";
      payload: { start: number; end: number; selected: boolean };
    }
  | { type: "SELECT_ALL_FRAMES" }
  | { type: "CLEAR_FRAME_SELECTION" }
  | { type: "SET_LAST_SELECTED_INDEX"; payload: number | null }
  | {
      type: "SET_PROCESSING";
      payload: { isProcessing: boolean; message?: string; progress?: number };
    }
  | { type: "SET_BACKGROUND_MODEL"; payload: BackgroundModel }
  | {
      type: "SET_CHROMA_KEY";
      payload: { applied: boolean; color?: string; tolerance?: number };
    }
  | {
      type: "SET_HALO_REMOVER";
      payload: { applied: boolean; expansion?: number };
    }
  | {
      type: "SET_CROP_SETTINGS";
      payload: Partial<
        Pick<
          SpriteProcessorState,
          | "isCropApplied"
          | "cropMode"
          | "canvasSize"
          | "reductionAmount"
          | "cropAlignX"
          | "cropAlignY"
        >
      >;
    }
  | {
      type: "SET_PREVIEW_SETTINGS";
      payload: Partial<
        Pick<
          SpriteProcessorState,
          "previewFps" | "previewZoom" | "previewBgColor" | "thumbnailZoom"
        >
      >;
    }
  | { type: "SET_CURRENT_STEP"; payload: SpriteProcessorState["currentStep"] }
  | { type: "SET_IS_PLAYING"; payload: boolean }
  | {
      type: "UPDATE_FRAME_PROCESSED_CANVAS";
      payload: { index: number; canvas: HTMLCanvasElement };
    }
  | { type: "RESET" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function spriteProcessorReducer(
  state: SpriteProcessorState,
  action: SpriteProcessorAction
): SpriteProcessorState {
  switch (action.type) {
    case "SET_MEDIA_FILE":
      return {
        ...initialState,
        currentMediaFile: action.payload.file,
        mediaType: action.payload.mediaType,
        sourceBaseName: action.payload.baseName,
        currentStep:
          action.payload.mediaType === "video"
            ? "video-settings"
            : "frame-selection",
      };

    case "SET_VIDEO_FPS":
      return { ...state, videoFPS: action.payload };

    case "SET_EXTRACTED_FRAMES":
      return {
        ...state,
        extractedFrames: action.payload,
        selectedFrames: new Set(action.payload.map((_, i) => i)),
        lastSelectedIndex: null,
        currentStep: "frame-selection",
      };

    case "TOGGLE_FRAME_SELECTION": {
      const next = new Set(state.selectedFrames);
      if (next.has(action.payload)) next.delete(action.payload);
      else next.add(action.payload);
      return { ...state, selectedFrames: next, lastSelectedIndex: action.payload };
    }

    case "SET_FRAME_RANGE_SELECTION": {
      const next = new Set(state.selectedFrames);
      const lo = Math.min(action.payload.start, action.payload.end);
      const hi = Math.max(action.payload.start, action.payload.end);
      for (let i = lo; i <= hi; i++) {
        if (action.payload.selected) next.add(i);
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
      return { ...state, lastSelectedIndex: action.payload };

    case "SET_PROCESSING":
      return {
        ...state,
        isProcessing: action.payload.isProcessing,
        processingMessage:
          action.payload.message ?? state.processingMessage,
        processingProgress:
          action.payload.progress ?? state.processingProgress,
      };

    case "SET_BACKGROUND_MODEL":
      return { ...state, backgroundModel: action.payload };

    case "SET_CHROMA_KEY":
      return {
        ...state,
        isChromaKeyApplied: action.payload.applied,
        chromaKeyColor: action.payload.color ?? state.chromaKeyColor,
        chromaKeyTolerance:
          action.payload.tolerance ?? state.chromaKeyTolerance,
      };

    case "SET_HALO_REMOVER":
      return {
        ...state,
        isHaloRemoverApplied: action.payload.applied,
        haloExpansion: action.payload.expansion ?? state.haloExpansion,
      };

    case "SET_CROP_SETTINGS":
      return { ...state, ...action.payload };

    case "SET_PREVIEW_SETTINGS":
      return { ...state, ...action.payload };

    case "SET_CURRENT_STEP":
      return { ...state, currentStep: action.payload };

    case "SET_IS_PLAYING":
      return { ...state, isPlaying: action.payload };

    case "UPDATE_FRAME_PROCESSED_CANVAS": {
      const frames = [...state.extractedFrames];
      if (frames[action.payload.index]) {
        frames[action.payload.index] = {
          ...frames[action.payload.index],
          processedCanvas: action.payload.canvas,
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

export interface SpriteProcessorContextValue {
  state: SpriteProcessorState;
  dispatch: React.Dispatch<SpriteProcessorAction>;
}

const SpriteProcessorContext =
  createContext<SpriteProcessorContextValue | null>(null);

export function SpriteProcessorProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(spriteProcessorReducer, initialState);
  return (
    <SpriteProcessorContext.Provider value={{ state, dispatch }}>
      {children}
    </SpriteProcessorContext.Provider>
  );
}

export function useSpriteProcessor(): SpriteProcessorContextValue {
  const ctx = useContext(SpriteProcessorContext);
  if (!ctx)
    throw new Error(
      "useSpriteProcessor must be used within SpriteProcessorProvider"
    );
  return ctx;
}
