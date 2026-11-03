import type { AvatarConfig } from '@contract';
import { selectedOptionValue } from '@/lib/avatars';

/**
 * The "More options" groups on the Characters step (design spec 12.5.3, FR-96 to FR-102): face
 * shape, six more clothing styles and a pattern. Pure data and rules, so they can be unit tested.
 * Labels name the shape, the garment or the fabric, never a person (FR-76, FR-99).
 */

export const MORE_OPTIONS_LABEL = 'More options';

export const FACE_SHAPE_GROUP = 'Face shape (optional)';
export const FACE_SHAPE_HELPER = 'Changes the shape of the face. Your other choices stay as they are.';

export const PATTERN_GROUP = 'Pattern (optional)';
export const PATTERN_HELPER =
  'Adds a pattern in tints of your colour. There is no second colour to pick.';

export const MORE_STYLES_GROUP = 'More styles (optional)';

/** Today's six clothing styles. They stay visible in "Outfit style", unchanged (FR-102). */
export const CLOSED_OUTFIT_STYLES: ReadonlyArray<string> = [
  'tee-jeans',
  'hoodie',
  'shirt-trousers',
  'dress',
  'suit',
  'jumpsuit',
];

/** The styles the builder offers (its own list may hide new ones until their garments exist). */
export function closedStyles(offered: readonly string[]): string[] {
  return offered.filter((id) => CLOSED_OUTFIT_STYLES.includes(id));
}

/** The styles that belong in "More styles": every offered style that is not one of today's six. */
export function moreStyles(offered: readonly string[]): string[] {
  return offered.filter((id) => !CLOSED_OUTFIT_STYLES.includes(id));
}

export type MoreOptionsTab = 'body' | 'face' | 'hair' | 'outfit';

/** True when the tab has a "More options" disclosure at all. */
export function tabHasMoreOptions(tab: MoreOptionsTab): boolean {
  // Face shape is on Face; Pattern is on Outfit even when no new style is offered yet.
  return tab === 'face' || tab === 'outfit';
}

/**
 * How many groups inside More options are off their default for this tab. The count chip on the
 * closed button uses it, so a changed value is never hidden (design spec 12.5.3). A style chosen
 * from the six new ones counts as one change.
 */
export function changedInMoreOptions(tab: MoreOptionsTab, config: AvatarConfig): number {
  if (tab === 'face') return selectedOptionValue(config, 'faceShape') !== 'oval' ? 1 : 0;
  if (tab === 'outfit') {
    const style = !CLOSED_OUTFIT_STYLES.includes(config.outfitStyle) ? 1 : 0;
    const pattern = selectedOptionValue(config, 'outfitPattern') !== 'plain' ? 1 : 0;
    return style + pattern;
  }
  return 0;
}
