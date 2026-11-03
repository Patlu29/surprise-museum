import { describe, expect, it } from 'vitest';
import { AVATAR_OPTIONS } from '@contract';
import {
  avatarOptionLabel,
  DEFAULT_GUIDE_AVATAR,
  FACE_SHAPE_LABELS,
  optionIds,
  OUTFIT_PATTERN_LABELS,
} from '@/lib/avatars';
import {
  changedInMoreOptions,
  CLOSED_OUTFIT_STYLES,
  closedStyles,
  moreStyles,
  tabHasMoreOptions,
} from './extraOptions';

describe('More options rules (design spec 12.5.3)', () => {
  it('keeps today six styles in "Outfit style" whether or not the list offers the new ones', () => {
    const all = AVATAR_OPTIONS.outfitStyle as readonly string[];
    expect(closedStyles(all)).toEqual([...CLOSED_OUTFIT_STYLES]);
    expect(closedStyles([...CLOSED_OUTFIT_STYLES])).toEqual([...CLOSED_OUTFIT_STYLES]);
  });

  it('shows the new styles only when the builder list offers them', () => {
    const all = AVATAR_OPTIONS.outfitStyle as readonly string[];
    expect(moreStyles(all)).toEqual(['sweater', 'overalls', 'coat', 'tracksuit', 'cardigan', 'tunic']);
    expect(moreStyles([...CLOSED_OUTFIT_STYLES])).toEqual([]);
  });

  it('puts the disclosure on Face and Outfit only', () => {
    expect(tabHasMoreOptions('face')).toBe(true);
    expect(tabHasMoreOptions('outfit')).toBe(true);
    expect(tabHasMoreOptions('body')).toBe(false);
    expect(tabHasMoreOptions('hair')).toBe(false);
  });

  it('counts groups off their default, and treats missing values as the default', () => {
    expect(changedInMoreOptions('face', DEFAULT_GUIDE_AVATAR)).toBe(0);
    const legacy = { ...DEFAULT_GUIDE_AVATAR };
    delete (legacy as Partial<typeof legacy>).faceShape;
    delete (legacy as Partial<typeof legacy>).outfitPattern;
    expect(changedInMoreOptions('face', legacy)).toBe(0);
    expect(changedInMoreOptions('outfit', legacy)).toBe(0);
    expect(changedInMoreOptions('face', { ...DEFAULT_GUIDE_AVATAR, faceShape: 'round' })).toBe(1);
    expect(
      changedInMoreOptions('outfit', { ...DEFAULT_GUIDE_AVATAR, outfitStyle: 'coat', outfitPattern: 'dots' }),
    ).toBe(2);
    expect(changedInMoreOptions('body', { ...DEFAULT_GUIDE_AVATAR, faceShape: 'long' })).toBe(0);
  });

  it('reads its face shape and pattern ids and labels from the shared option lists', () => {
    expect(optionIds('faceShape')).toEqual(['oval', 'round', 'square', 'heart', 'long']);
    expect(optionIds('outfitPattern')).toEqual(['plain', 'stripes', 'checks', 'dots']);
    for (const id of optionIds('faceShape')) {
      expect(avatarOptionLabel('faceShape', id)).toBe(FACE_SHAPE_LABELS[id]);
    }
    for (const id of optionIds('outfitPattern')) {
      expect(avatarOptionLabel('outfitPattern', id)).toBe(OUTFIT_PATTERN_LABELS[id]);
    }
  });
});
