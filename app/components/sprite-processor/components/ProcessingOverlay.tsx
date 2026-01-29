"use client";

interface ProcessingOverlayProps {
  message: string;
  progress: number;
  submessage?: string;
}

export function ProcessingOverlay({ message, progress, submessage }: ProcessingOverlayProps) {
  return (
    <div className="p-8 glass-card-elevated text-center">
      <div className="spinner" />
      <p className="text-[#ffb3b3] font-semibold text-[14px] mb-2">{message}</p>
      {submessage && <p className="text-[#52525b] text-[12px] mb-4">{submessage}</p>}
      <div className="progress-bar max-w-sm mx-auto">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-[#52525b] text-[11px] mt-2 font-mono">{progress}%</p>
    </div>
  );
}
