"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

// Helper function to format time as relative (e.g., "2 hours ago")
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) {
    return "just now";
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days === 1) {
    return "yesterday";
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    // Format as date for older items
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}
interface CustomRegion {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GridConfig {
  cols: number;
  rows: number;
  verticalDividers: number[];
  horizontalDividers: number[];
  customRegions?: CustomRegion[];
  mode?: "grid" | "custom";
}

interface Creation {
  _id: Id<"creations">;
  presetId: string;
  presetName: string;
  customPrompt?: string;
  characterName: string;
  currentStep: number;
  completedSteps: number[];
  status: "in_progress" | "completed";
  createdAt: number;
  updatedAt: number;
  sessionId?: string;
  gridConfigs?: Record<string, GridConfig>;
}

interface RecentCreationsGalleryProps {
  onContinue: (creation: Creation, imageUrls: Record<string, string>) => void;
  onViewOutput: (creation: Creation, imageUrls: Record<string, string>) => void;
  currentCreationId?: Id<"creations"> | null;
  onOpenHistory: () => void;
}

interface ThumbnailCardProps {
  creation: Creation;
  onContinue: () => void;
  onViewOutput: () => void;
  isLoading: boolean;
  isCurrentCreation: boolean;
  onDelete: (creationId: Id<"creations">) => void;
}

function ThumbnailCard({
  creation,
  onContinue,
  onViewOutput,
  isLoading,
  isCurrentCreation,
  onDelete,
}: ThumbnailCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(creation.characterName);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const getThumbnailUrl = useAction(api.images.getThumbnailUrl);
  const renameMutation = useMutation(api.creations.rename);

  useEffect(() => {
    async function fetchThumbnail() {
      try {
        const url = await getThumbnailUrl({ creationId: creation._id });
        setThumbnailUrl(url);
      } catch (e) {
        // Thumbnail not available
      }
    }
    fetchThumbnail();
  }, [creation._id, getThumbnailUrl]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when renaming
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRename = async () => {
    const trimmedName = newName.trim();
    if (trimmedName && trimmedName !== creation.characterName) {
      try {
        await renameMutation({ creationId: creation._id, characterName: trimmedName });
      } catch (e) {
        console.error("Failed to rename:", e);
        setNewName(creation.characterName); // Revert on error
      }
    } else {
      setNewName(creation.characterName); // Revert if empty or same
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setNewName(creation.characterName);
      setIsRenaming(false);
    }
  };

  const handleDeleteClick = () => {
    setIsMenuOpen(false);
    setIsDeleting(true);
  };

  const confirmDelete = () => {
    onDelete(creation._id);
    setIsDeleting(false);
  };

  const maxStep = 8;
  const progressPercent = (creation.currentStep / maxStep) * 100;
  const isComplete = creation.status === "completed" || creation.currentStep >= 7;

  return (
    <div
      className={`bg-surface-tertiary border rounded-lg p-2.5 flex flex-col gap-2 transition-all hover:border-stroke-hover ${
        isCurrentCreation
          ? "border-fal-purple-light bg-fal-purple-light/5"
          : "border-stroke"
      } max-sm:p-2 relative`}
    >
      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <div className="absolute inset-0 bg-black/80 rounded-lg flex flex-col items-center justify-center z-20 p-3">
          <p className="text-white text-xs text-center mb-3">Delete "{creation.characterName}"?</p>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 text-[0.7rem] rounded bg-red-500 text-white border-none hover:bg-red-600 transition-colors"
              onClick={confirmDelete}
            >
              Delete
            </button>
            <button
              className="px-3 py-1.5 text-[0.7rem] rounded bg-surface-elevated text-content-secondary border-none hover:bg-surface-tertiary transition-colors"
              onClick={() => setIsDeleting(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Menu Button */}
      <div className="absolute top-1 right-1 z-10" ref={menuRef}>
        <button
          className="w-6 h-6 flex items-center justify-center rounded bg-black/50 text-white/70 hover:bg-black/70 hover:text-white transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          title="More options"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
        
        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute top-7 right-0 bg-surface-elevated border border-stroke rounded-md shadow-lg overflow-hidden min-w-[100px]">
            <button
              className="w-full px-3 py-2 text-left text-xs text-content-primary hover:bg-fal-purple-light/20 flex items-center gap-2 transition-colors"
              onClick={() => {
                setIsMenuOpen(false);
                setIsRenaming(true);
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              Rename
            </button>
            <button
              className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/20 flex items-center gap-2 transition-colors"
              onClick={handleDeleteClick}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="relative w-full aspect-square rounded-md overflow-hidden bg-surface-elevated">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={creation.characterName}
            className="w-full h-full object-cover pixelated"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-fal-purple-deep to-fal-purple-light text-white text-2xl font-semibold">
            <span>{creation.characterName.charAt(0).toUpperCase()}</span>
          </div>
        )}
        {isCurrentCreation && (
          <div className="absolute top-1 left-1 bg-fal-purple-light text-white text-[0.6rem] font-semibold px-1.5 py-0.5 rounded">
            Current
          </div>
        )}
      </div>
      <div className="text-center">
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="w-full text-xs font-medium text-content-primary bg-surface-elevated border border-fal-purple-light rounded px-2 py-1 text-center focus:outline-none"
            maxLength={50}
          />
        ) : (
          <div className="text-xs font-medium text-content-primary truncate max-sm:text-[0.7rem]">
            {creation.characterName}
          </div>
        )}
        <div className="h-0.5 bg-surface-elevated rounded mt-1 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-fal-purple-deep to-fal-purple-light rounded transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-[0.65rem] text-content-tertiary mt-1 flex items-center justify-center gap-1.5">
          <span>{creation.status === "completed" ? "Complete" : `Step ${creation.currentStep}/8`}</span>
          <span className="opacity-50">•</span>
          <span>{formatRelativeTime(creation.createdAt)}</span>
        </div>
      </div>
      <div className="flex justify-center">
        {isComplete ? (
          <button
            className="py-1.5 px-2.5 text-[0.7rem] rounded bg-fal-cyan text-white border-none flex items-center gap-1 transition-all hover:bg-fal-blue-light disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onViewOutput}
            disabled={isLoading || isCurrentCreation}
            title="View final output"
          >
            {isLoading ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                View
              </>
            )}
          </button>
        ) : (
          <button
            className="py-1.5 px-2.5 text-[0.7rem] rounded bg-fal-purple-deep text-white border-none flex items-center gap-1 transition-all hover:bg-fal-purple-light disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onContinue}
            disabled={isLoading || isCurrentCreation}
            title="Continue editing"
          >
            {isLoading ? (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                Continue
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RecentCreationsGallery({
  onContinue,
  onViewOutput,
  currentCreationId,
  onOpenHistory,
}: RecentCreationsGalleryProps) {
  const [loadingId, setLoadingId] = useState<Id<"creations"> | null>(null);

  // Query all recent creations (limited to 6 for the gallery)
  const creations = useQuery(api.creations.listRecent, { limit: 6 });

  const getImageUrls = useAction(api.images.getCreationImageUrls);
  const deleteMutation = useMutation(api.creations.remove);

  const handleContinue = async (creation: Creation) => {
    if (loadingId) return;
    setLoadingId(creation._id);

    try {
      const imageUrls = await getImageUrls({ creationId: creation._id });
      onContinue(creation, imageUrls);
    } catch (e) {
      console.error("Failed to load creation:", e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleViewOutput = async (creation: Creation) => {
    if (loadingId) return;
    setLoadingId(creation._id);

    try {
      const imageUrls = await getImageUrls({ creationId: creation._id });
      onViewOutput(creation, imageUrls);
    } catch (e) {
      console.error("Failed to load creation:", e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (creationId: Id<"creations">) => {
    try {
      await deleteMutation({ creationId });
    } catch (e) {
      console.error("Failed to delete creation:", e);
    }
  };

  // Don't show if no creations or still loading
  if (!creations || creations.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 pt-6 border-t border-stroke">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[0.95rem] font-semibold text-content-primary m-0">
          Recent Creations
        </h3>
        <button
          className="bg-transparent border-none text-content-secondary text-xs flex items-center gap-1 py-1 px-2 rounded transition-all hover:text-fal-purple-light hover:bg-fal-purple-light/10"
          onClick={onOpenHistory}
        >
          View all
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 max-sm:grid-cols-[repeat(auto-fill,minmax(100px,1fr))] max-sm:gap-2">
        {creations.map((creation) => (
          <ThumbnailCard
            key={creation._id}
            creation={creation}
            onContinue={() => handleContinue(creation)}
            onViewOutput={() => handleViewOutput(creation)}
            isLoading={loadingId === creation._id}
            isCurrentCreation={currentCreationId === creation._id}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}
