import type { BuilderStep } from '@/state/draft';
import { BUILDER_STEPS } from '@/state/draft';
import { Icon } from '@/ui/components/Icon';

interface StepperProps {
  step: BuilderStep;
  maxStep: BuilderStep;
  onSelect: (step: BuilderStep) => void;
}

/** The short label drawn on phones and tablets under each segment (design spec 12.4.2). */
const SHORT_LABEL: Partial<Record<BuilderStep, string>> = { 4: 'Review' };

function StepLabel({ step, label, done }: { step: BuilderStep; label: string; done: boolean }) {
  const short = SHORT_LABEL[step] ?? label;
  return (
    <span className="stepper__label">
      {done ? <Icon name="check" size="sm" className="stepper__check" /> : null}
      {short !== label ? (
        <>
          <span className="stepper__label-short" aria-hidden="true">
            {short}
          </span>
          <span className="stepper__label-full">{label}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
      {done ? <span className="visually-hidden"> (done)</span> : null}
    </span>
  );
}

/**
 * Phone and tablet: "Step 2 of 4" over four segments, each with a short label (design spec
 * 12.4.2). Desktop: a numbered list in the left rail with a check when complete. The nav's text
 * stays "Step 2 of 4: Words" in the DOM (the name is visually hidden). Steps not yet reached are
 * not offered. The current step has `aria-current="step"`; completion is never colour alone.
 */
export function Stepper({ step, maxStep, onSelect }: StepperProps) {
  const current = BUILDER_STEPS.find((item) => item.step === step);
  return (
    <nav className="stepper" aria-label="Builder steps">
      <p className="stepper__summary">
        Step {step} of {BUILDER_STEPS.length}
        <span className="visually-hidden">: {current?.label}</span>
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
                  <StepLabel step={item.step} label={item.label} done={done} />
                </button>
              ) : (
                <span className="stepper__item is-locked">
                  <span className="stepper__marker" aria-hidden="true">
                    {item.step}
                  </span>
                  <StepLabel step={item.step} label={item.label} done={false} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
