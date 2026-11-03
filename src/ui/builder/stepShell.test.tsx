import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DraftIssue } from '@/state/draft';
import { Stepper } from './Stepper';
import { StillToDo } from './StillToDo';

const issue = (id: string, step: 1 | 2 | 4): DraftIssue => ({ id, fieldId: id, step, message: id });

describe('StillToDo', () => {
  it('lists a chip button for each outstanding item, in step order', () => {
    const html = renderToStaticMarkup(
      <StillToDo
        placement="inline"
        onSelect={() => {}}
        issues={[issue('consent', 4), issue('visitor-name', 2), issue('photos', 1)]}
      />,
    );
    expect(html).toContain('Still to do');
    const order = ['Add a photo', "Add the Visitor&#x27;s name", 'Confirm you can share the photos'].map((text) =>
      html.indexOf(text),
    );
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.match(/still-to-do__chip/g)).toHaveLength(3);
  });

  it('says it is ready when nothing is left, and is not a live region', () => {
    const html = renderToStaticMarkup(<StillToDo placement="rail" onSelect={() => {}} issues={[]} />);
    expect(html).toContain('Ready to publish');
    expect(html).not.toContain('aria-live');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain('role="alert"');
  });
});

describe('Stepper', () => {
  it('keeps the text "Step 2 of 4: Words" in the DOM with only "Step 2 of 4" showing', () => {
    const html = renderToStaticMarkup(<Stepper step={2} maxStep={2} onSelect={() => {}} />);
    expect(html).toContain('Step 2 of 4<span class="visually-hidden">: Words</span>');
  });

  it('keeps the full accessible name for the last step and shows a short label', () => {
    const html = renderToStaticMarkup(<Stepper step={1} maxStep={4} onSelect={() => {}} />);
    expect(html).toContain('<span class="stepper__label-full">Review and publish</span>');
    expect(html).toContain('<span class="stepper__label-short" aria-hidden="true">Review</span>');
  });
});
