/**
 * The avatar option labels, defaults and `describeAvatar` live in the domain, so the UI (which
 * may not import `@/scene`) can use them. This file re-exports them for the kit and its tests:
 * there is one source of truth.
 */
export {
  BODY_TYPE_LABELS,
  DEFAULT_GUIDE_APPEARANCE,
  DEFAULT_VISITOR_APPEARANCE,
  FACIAL_HAIR_LABELS,
  HAIR_COLOR_LABELS,
  HAIR_STYLE_LABELS,
  HEIGHT_LABELS,
  OUTFIT_COLOR_LABELS,
  OUTFIT_STYLE_LABELS,
  SKIN_LABELS,
  describeAvatar,
} from '@/domain/characters/avatarOptions';
