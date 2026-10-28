import type { BuilderStep } from '@/state/draft';
import { BUILDER_STEPS } from '@/state/draft';
import { Icon } from '@/ui/components/Icon';

interface StepperProps {
  step: BuilderStep;
  maxStep: BuilderStep;
  onSelect: (step: BuilderStep) => void;
}

/**
 * Phone: "Step 2 of 4: Words" and four segments. Desktop: a numbered list in the left rail with
 * a check when complete (design spec 5.16). Steps not yet reached are not offered. The current
 * step has `aria-current="step"`; completion is never colour alone.
 */
export function Stepper({ step, maxStep, onSelect }: StepperProps) {
  const current = BUILDER_STEPS.find((item) => item.step === step);
  return (
    <nav className="stepper" aria-label="Builder steps">
      <p className="stepper__summary">
        Step {step} of {BUILDER_STEPS.length}: {current?.label}
      </p>
      <ol className="stepper__list">
        {BUILDER_STEPS.map((item) => {
          const reachable = item.step <= maxStep;
          const done = item.step < step;
          const isCurrent = item.step === step;
          return (
            <li key={item.step} className="stepper__entry">
              {reachable ? (
                <button
                  type="button"
                  className={['stepper__item', isCurrent && 'is-current', done && 'is-done']
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={isCurrent ? 'step' : undefined}
                  onClick={() => onSelect(item.step)}
                >
                  <span className="stepper__marker" aria-hidden="true">
                    {done ? <Icon name="check" size="sm" /> : item.step}
                  </span>
                  <span className="stepper__label">
                    {item.label}
                    {done ? <span className="visually-hidden"> (done)</span> : null}
                  </span>
                </button>
              ) : (
                <span className="stepper__item is-locked">
                  <span className="stepper__marker" aria-hidden="true">
                    {item.step}
                  </span>
                  <span className="stepper__label">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
