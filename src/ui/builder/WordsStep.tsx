import { useState } from 'react';
import { LIMITS } from '@contract';
import { useDraftIssues } from '@/hooks/useDraftIssues';
import { useBuilderStore } from '@/state/builderStore';
import type { DraftIssue } from '@/state/draft';
import { effectiveTitle, FIELD_IDS } from '@/state/draft';
import { LimitedField } from '@/ui/components/LimitedField';
import { NameLabel } from '@/ui/components/NameLabel';
import { StepSection } from '@/ui/components/StepSection';
import { CLOSING_MESSAGE_PLACEHOLDER, SECTION, titlePlaceholder } from './stepCopy';

/**
 * Step 2: the names, title and closing message (FR-7, FR-8, design spec 12.5.2). The two required
 * names come first, then the live sample, then the optional words. Defaults show as placeholders
 * and are never stored. A required field shows its message once the Creator has left it (blur) or
 * after a failed Next, and never while they are typing in it (FR-87).
 */
export function WordsStep({ issues }: { issues: readonly DraftIssue[] }) {
  const visitorName = useBuilderStore((state) => state.visitorName);
  const guideName = useBuilderStore((state) => state.guideName);
  const title = useBuilderStore((state) => state.title);
  const closingMessage = useBuilderStore((state) => state.closingMessage);
  const setText = useBuilderStore((state) => state.setText);

  const live = useDraftIssues('preview');
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [focused, setFocused] = useState<string | null>(null);

  const errorFor = (fieldId: string): string | null => {
    const current = live.find((issue) => issue.fieldId === fieldId);
    if (!current) return null;
    const afterFailedNext = issues.some((issue) => issue.fieldId === fieldId);
    const afterBlur = touched.has(fieldId) && focused !== fieldId;
    return afterFailedNext || afterBlur ? current.message : null;
  };
  const track = (fieldId: string) => ({
    onFieldFocus: () => setFocused(fieldId),
    onFieldBlur: () => {
      setFocused((now) => (now === fieldId ? null : now));
      setTouched((now) => new Set(now).add(fieldId));
    },
  });

  return (
    <div className="step-sections">
      <StepSection title={SECTION.names} tag="required" variant="emphasis">
        <div className="stack">
          <LimitedField
            id={FIELD_IDS.visitorName}
            label="Who is this museum for?"
            helper={`Their name floats above their head. Up to ${LIMITS.nameMaxChars} characters.`}
            value={visitorName}
            onChange={(value) => setText('visitorName', value)}
            max={LIMITS.nameMaxChars}
            required
            autoCapitalize="words"
            error={errorFor(FIELD_IDS.visitorName)}
            {...track(FIELD_IDS.visitorName)}
          />
          <LimitedField
            id={FIELD_IDS.guideName}
            label="Your name"
            helper={`Your guide wears this above their head. Up to ${LIMITS.nameMaxChars} characters.`}
            value={guideName}
            onChange={(value) => setText('guideName', value)}
            max={LIMITS.nameMaxChars}
            required
            autoCapitalize="words"
            error={errorFor(FIELD_IDS.guideName)}
            {...track(FIELD_IDS.guideName)}
          />
        </div>
      </StepSection>

      <section className="sample" aria-labelledby="sample-heading">
        <h2 id="sample-heading" className="sample__heading">
          {SECTION.sample}
        </h2>
        <p className="eyebrow">A private view</p>
        <p className="sample__title user-text">{effectiveTitle(title, visitorName)}</p>
        <p className="muted">
          For <span className="user-text">{visitorName.trim() || 'your visitor'}</span>
        </p>
        <div className="sample__labels">
          <NameLabel role="visitor" name={visitorName} placeholder="Visitor" />
          <NameLabel role="guide" name={guideName} placeholder="Guide" />
        </div>
      </section>

      <StepSection title={SECTION.optionalWords} tag="optional" variant="quiet">
        <div className="stack">
          <LimitedField
            id={FIELD_IDS.title}
            label="Museum title (optional)"
            helper="Leave it blank to use the title shown in the box."
            value={title}
            onChange={(value) => setText('title', value)}
            max={LIMITS.titleMaxChars}
            placeholder={titlePlaceholder(visitorName)}
          />
          <LimitedField
            id={FIELD_IDS.closingMessage}
            label="Closing message (optional)"
            helper={`Your guide shares this when they reach the finale. Up to ${LIMITS.closingMessageMaxChars.toLocaleString('en-AU')} characters.`}
            value={closingMessage}
            onChange={(value) => setText('closingMessage', value)}
            max={LIMITS.closingMessageMaxChars}
            multiline
            rows={6}
            lang="en-AU"
            spellCheck
            placeholder={CLOSING_MESSAGE_PLACEHOLDER}
          />
        </div>
      </StepSection>
    </div>
  );
}
