import React from 'react';
import { ChevronRight, Check } from 'lucide-react';

export interface WorkflowStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  role: string;
  status: 'completed' | 'active' | 'pending' | 'warning';
  count?: number | string;
  countLabel?: string;
}

interface WorkflowStepperProps {
  title: string;
  regulationCode: string;
  steps: WorkflowStep[];
  currentStepIndex?: number;
  onStepClick?: (stepIndex: number) => void;
}

export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  title,
  regulationCode,
  steps,
  currentStepIndex,
  onStepClick,
}) => {
  return (
    <div className="bg-slate-50/80 border border-slate-200/90 rounded-md px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
      {/* Left: Workflow Name & Regulation Tag */}
      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        <span className="text-xs font-semibold text-slate-800 whitespace-nowrap" title={title}>
          {title}
        </span>
        <span className="text-[10px] font-mono text-slate-400 border-l border-slate-200 pl-1.5 hidden md:inline whitespace-nowrap">
          {regulationCode}
        </span>
      </div>

      {/* Right: Slim Horizontal Process Pipeline */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
        {steps.map((step, idx) => {
          const isSelected = currentStepIndex === idx;

          let stepBadge = 'text-slate-500 bg-white border-slate-200';
          let dotColor = 'bg-slate-300';

          if (step.status === 'warning') {
            stepBadge = 'text-rose-700 bg-rose-50 border-rose-200 font-semibold';
            dotColor = 'bg-rose-500';
          } else if (step.status === 'active') {
            stepBadge = 'text-amber-800 bg-amber-50 border-amber-200 font-semibold';
            dotColor = 'bg-amber-500';
          } else if (step.status === 'completed') {
            stepBadge = 'text-slate-600 bg-white border-slate-200';
            dotColor = 'bg-emerald-500';
          }

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => onStepClick && onStepClick(idx)}
                title={`${step.title} (${step.role}): ${step.description}`}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] border transition cursor-pointer select-none whitespace-nowrap ${stepBadge} ${
                  isSelected ? 'ring-1 ring-slate-800 border-slate-800' : 'hover:border-slate-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`}></span>
                <span className="text-slate-400 font-mono text-[10px]">{step.stepNumber}.</span>
                <span className="truncate max-w-[160px]">{step.title}</span>
                {step.count !== undefined && (
                  <span className="font-mono text-[10px] opacity-75 font-semibold">
                    ({step.count})
                  </span>
                )}
              </button>
              {idx < steps.length - 1 && (
                <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

