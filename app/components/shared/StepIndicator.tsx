"use client";

interface StepIndicatorProps {
  currentStep: number;
  completedSteps: Set<number>;
  totalSteps?: number;
  onStepClick: (step: number) => void;
  getStepTitle: (step: number) => string;
}

export default function StepIndicator({
  currentStep,
  completedSteps,
  totalSteps = 6,
  onStepClick,
  getStepTitle,
}: StepIndicatorProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="flex justify-center gap-3 mb-10">
      {steps.map((step) => {
        const isCompleted = completedSteps.has(step);
        const isCurrent = currentStep === step;
        const isClickable = isCompleted || step < currentStep;

        return (
          <div
            key={step}
            className={`w-2.5 h-2.5 rounded-full border transition-all ${
              isCurrent
                ? "bg-fal-purple-light border-fal-purple-light"
                : isCompleted
                ? "bg-green-500 border-green-500"
                : "bg-surface-tertiary border-stroke"
            } ${isClickable ? "cursor-pointer hover:scale-[1.3] hover:shadow-[0_0_8px_#ab77ff]" : ""}`}
            title={getStepTitle(step)}
            onClick={() => isClickable && onStepClick(step)}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : -1}
            onKeyDown={(e) => {
              if (isClickable && (e.key === "Enter" || e.key === " ")) {
                onStepClick(step);
              }
            }}
          />
        );
      })}
    </div>
  );
}
