import { LIMITS } from '@contract';
import { useBuilderStore } from '@/state/builderStore';
import type { DraftIssue } from '@/state/draft';
import { effectiveTitle, FIELD_IDS } from '@/state/draft';
import { LimitedField } from '@/ui/components/LimitedField';
import { NameLabel } from '@/ui/components/NameLabel';

/** Step 2: the names, title and closing message (FR-7, FR-8, design spec 2.1 and Appendix B). */
export function WordsStep({ issues }: { issues: readonly DraftIssue[] }) {
  const visitorName = useBuilderStore((state) => state.visitorName);
  const guideName = useBuilderStore((state) => state.guideName);
  const title = useBuilderStore((state) => state.title);
  const closingMessage = useBuilderStore((state) => state.closingMessage);
  const setText = useBuilderStore((state) => state.setText);

  const errorFor = (fieldId: string) =>
    issues.find((issue) => issue.fieldId === fieldId)?.message ?? null;

  return (
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
      />
      <LimitedField
        id={FIELD_IDS.title}
        label="Museum title (optional)"
        helper={`Leave it blank and we'll use "A museum for ${visitorName.trim() || '{name}'}".`}
        value={title}
        onChange={(value) => setText('title', value)}
        max={LIMITS.titleMaxChars}
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
      />

      <section className="sample" aria-labelledby="sample-heading">
        <h2 id="sample-heading" className="sample__heading">
          How it will look
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
    </div>
  );
}
