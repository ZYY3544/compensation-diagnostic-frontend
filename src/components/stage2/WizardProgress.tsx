import React from 'react';

interface WizardProgressProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
}

const steps = [
  { num: 1, label: '数据解析' },
  { num: 2, label: '完整性检查' },
  { num: 3, label: '数据清洗' },
  { num: 4, label: '职级匹配' },
  { num: 5, label: '职能匹配' },
  { num: 6, label: '准备就绪' },
];

export default function WizardProgress({ currentStep, completedSteps, onStepClick }: WizardProgressProps) {
  return (
    <div className="wizard-progress">
      {steps.map((step, i) => {
        const isCompleted = completedSteps.includes(step.num);
        const isCurrent = currentStep === step.num;
        const isClickable = isCompleted;

        return (
          <React.Fragment key={step.num}>
            <div
              className={`wizard-step ${isClickable ? 'clickable' : ''}`}
              onClick={() => isClickable && onStepClick(step.num)}
            >
              <div className={`wizard-circle ${isCurrent ? 'current' : isCompleted ? 'completed' : 'pending'}`}>
                {isCompleted ? '✓' : step.num}
              </div>
              <span className={`wizard-label ${isCurrent ? 'current' : isCompleted ? 'completed' : 'pending'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`wizard-line ${isCompleted ? 'done' : 'pending'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
