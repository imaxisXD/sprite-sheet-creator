"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import HistoryItem from "./HistoryItem";

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
}

interface HistorySidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onLoadCreation: (creation: Creation, imageUrls: Record<string, string>) => void;
  currentCreationId?: Id<"creations"> | null;
}

export default function HistorySidebar({
  isOpen,
  onToggle,
  onLoadCreation,
  currentCreationId,
}: HistorySidebarProps) {
  const [loadingId, setLoadingId] = useState<Id<"creations"> | null>(null);

  // Query all creations
  const creations = useQuery(api.creations.listRecent, { limit: 20 });

  // Mutations
  const removeCreation = useMutation(api.creations.remove);
  const deleteImages = useAction(api.images.deleteCreationImages);
  const getImageUrls = useAction(api.images.getCreationImageUrls);

  const handleLoad = async (creation: Creation) => {
    if (loadingId) return;
    setLoadingId(creation._id);

    try {
      // Fetch image URLs from R2
      const imageUrls = await getImageUrls({ creationId: creation._id });
      onLoadCreation(creation, imageUrls);
    } catch (e) {
      console.error("Failed to load creation:", e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (creationId: Id<"creations">) => {
    try {
      // Delete images from R2 first
      await deleteImages({ creationId });
      // Then delete the creation record
      await removeCreation({ creationId });
    } catch (e) {
      console.error("Failed to delete creation:", e);
    }
  };

  return (
    <>
      {/* Toggle button (always visible) */}
      <button
        className={`fixed top-4 left-4 w-11 h-11 rounded-full bg-surface-elevated border border-stroke text-content-secondary flex items-center justify-center z-50 transition-all hover:bg-surface-tertiary hover:border-stroke-hover hover:text-content-primary ${
          isOpen ? "bg-fal-purple-deep border-fal-purple-deep text-white" : ""
        }`}
        onClick={onToggle}
        title={isOpen ? "Close history" : "Open history"}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {!isOpen && creations && creations.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-[5px] rounded-full bg-fal-purple-light text-white text-[0.7rem] font-semibold flex items-center justify-center">
            {creations.length}
          </span>
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 w-80 h-screen bg-surface-secondary border-r border-stroke z-[100] flex flex-col transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } max-md:w-full max-md:max-w-[320px]`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stroke flex-shrink-0">
          <h3 className="text-base font-semibold text-content-primary m-0">
            Creation History
          </h3>
          <button
            className="w-8 h-8 rounded-md bg-transparent border-none text-content-tertiary flex items-center justify-center transition-all hover:bg-surface-tertiary hover:text-content-primary"
            onClick={onToggle}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!creations ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-content-tertiary text-sm">
              <span className="w-3.5 h-3.5 border-2 border-stroke border-t-fal-purple-light rounded-full animate-spin" />
              <span>Loading history...</span>
            </div>
          ) : creations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-content-tertiary opacity-50"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21,15 16,10 5,21" />
              </svg>
              <p className="text-content-secondary text-[0.95rem] m-0">
                No creations yet
              </p>
              <span className="text-content-tertiary text-xs">
                Your sprite creations will appear here
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {creations.map((creation) => (
                <HistoryItem
                  key={creation._id}
                  creation={creation}
                  onLoad={handleLoad}
                  onDelete={handleDelete}
                  isLoading={loadingId === creation._id}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[90] backdrop-blur-sm"
          onClick={onToggle}
        />
      )}
    </>
  );
}
