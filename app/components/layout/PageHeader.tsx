"use client";

import FalLogo from "../shared/FalLogo";

interface PageHeaderProps {
  onHomeClick: () => void;
  onHistoryToggle: () => void;
  isHistoryOpen: boolean;
}

export default function PageHeader({
  onHomeClick,
  onHistoryToggle,
  isHistoryOpen,
}: PageHeaderProps) {
  return (
    <header className="text-center mb-10">
      <div className="flex items-center justify-between w-full mb-2">
        <button
          className="w-10 h-10 p-0 bg-surface-elevated border border-stroke-hover rounded-lg text-content-primary flex items-center justify-center transition-all hover:bg-fal-purple-deep hover:border-fal-purple-deep"
          onClick={onHomeClick}
          title="Return to Start"
          aria-label="Return to Start"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <FalLogo size={36} />
          <h1 className="m-0 text-2xl font-semibold text-content-primary">Ichigo Sprite Creator</h1>
        </div>
        <button
          className="w-10 h-10 p-0 bg-surface-elevated border border-stroke-hover rounded-lg text-content-primary flex items-center justify-center transition-all hover:bg-fal-purple-deep hover:border-fal-purple-deep"
          onClick={onHistoryToggle}
          title="History"
          aria-label="Toggle History"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </button>
      </div>
      <p className="text-content-secondary m-0">Create sprite sheets for Ichigo Journey using fal.ai</p>
    </header>
  );
}
