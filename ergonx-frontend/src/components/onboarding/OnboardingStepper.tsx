"use client";

import {
  Check,
  Circle,
} from "lucide-react";

import {
  OnboardingStep,
  OnboardingStepId,
} from "@/types/onboarding";

interface OnboardingStepperProps {
  steps: OnboardingStep[];
  currentStep: number;
  completedSteps: OnboardingStepId[];
  onStepClick: (index: number) => void;
}

export default function OnboardingStepper({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: OnboardingStepperProps) {
  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        const completed =
          completedSteps.includes(step.id);

        const active = index === currentStep;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick(index)}
            className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition ${
              active
                ? "bg-slate-950 text-white"
                : "hover:bg-slate-100"
            }`}
          >
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                active
                  ? "border-white bg-white text-slate-950"
                  : completed
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-300 text-slate-400"
              }`}
            >
              {completed ? (
                <Check size={14} />
              ) : active ? (
                <Circle
                  size={10}
                  fill="currentColor"
                />
              ) : (
                <span className="text-xs">
                  {index + 1}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <p
                className={`text-sm font-medium ${
                  active
                    ? "text-white"
                    : "text-slate-800"
                }`}
              >
                {step.title}
              </p>

              <p
                className={`mt-0.5 text-xs leading-5 ${
                  active
                    ? "text-slate-300"
                    : "text-slate-500"
                }`}
              >
                {step.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
