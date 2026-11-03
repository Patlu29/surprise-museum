import { useMemo, useState } from 'react';
import type { AvatarConfig } from '@contract';
import { avatarFaceShape, avatarOutfitPattern } from '@contract';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { AvatarOptionKey, AvatarRole } from '@/lib/avatars';
import { avatarOptionLabel, describeAvatar, optionIds, selectedGender } from '@/lib/avatars';
import { useBuilderStore } from '@/state/builderStore';
import { Button } from '@/ui/components/Button';
import { RadioGroup, type RadioOption } from '@/ui/components/RadioGroup';
import { Tabs } from '@/ui/components/Tabs';
import { AvatarPreviewSlot } from './AvatarPreviewSlot';
import { MoreOptions } from './MoreOptions';
import {
  changedInMoreOptions,
  closedStyles,
  FACE_SHAPE_GROUP,
  FACE_SHAPE_HELPER,
  FACE_SHAPE_LABELS,
  faceShapeIds,
  MORE_STYLES_GROUP,
  moreStyles,
  PATTERN_GROUP,
  PATTERN_HELPER,
  PATTERN_LABELS,
  patternIds,
  tabHasMoreOptions,
} from './extraOptions';
import { FaceShapeGlyph, GarmentGlyph, PatternGlyph } from './optionGlyphs';
import { CHARACTERS_ROLE_LINE } from './stepCopy';

type Section = 'face' | 'hair' | 'outfit' | 'body';

/** Body is first and opens by default: Gender sets the base shape the rest sit on (spec 9.4). */
const SECTIONS: ReadonlyArray<{ id: Section; label: string }> = [
  { id: 'body', label: 'Body' },
  { id: 'face', label: 'Face' },
  { id: 'hair', label: 'Hair' },
  { id: 'outfit', label: 'Outfit' },
];

export const GENDER_HELPER_TEXT =
  'Changes the shape and face. Your other choices stay as they are.';

const TURN_STEP_DEGREES = 30;
const BACK_VIEW_DEGREES = 180;

/** Every option in the customiser is one of these: a labelled radiogroup (design spec 5.3). */
interface GroupDef {
  key: AvatarOptionKey;
  label: string;
  variant: 'tiles' | 'swatches';
  /** CSS custom property prefix for swatch colours, from tokens.css. */
  swatchPrefix?: string;
  /** Helper text shown below the options. */
  description?: string;
  /** Extra class for layout (the gender row and the two-column body type grid). */
  className?: string;
}

const GROUPS: Record<Section, GroupDef[]> = {
  face: [
    { key: 'skinTone', label: 'Skin tone', variant: 'swatches', swatchPrefix: '--avatar-' },
    { key: 'facialHair', label: 'Facial hair', variant: 'tiles' },
  ],
  hair: [
    { key: 'hairStyle', label: 'Hair style', variant: 'tiles' },
    { key: 'hairColor', label: 'Hair colour', variant: 'swatches', swatchPrefix: '--avatar-hair-' },
  ],
  outfit: [
    { key: 'outfitStyle', label: 'Outfit style', variant: 'tiles' },
    {
      key: 'outfitColor',
      label: 'Outfit colour',
      variant: 'swatches',
      swatchPrefix: '--avatar-outfit-',
    },
  ],
  body: [
    {
      key: 'gender',
      label: 'Gender (optional)',
      variant: 'tiles',
      description: GENDER_HELPER_TEXT,
      className: 'radio-group--gender',
    },
    { key: 'bodyType', label: 'Body type', variant: 'tiles', className: 'radio-group--two-column' },
    { key: 'height', label: 'Height', variant: 'tiles' },
  ],
};

function optionsFor(def: GroupDef): Array<RadioOption<string>> {
  // "Outfit style" is today's six tiles, whatever the builder's list offers beyond them (FR-102).
  const ids =
    def.key === 'outfitStyle'
      ? closedStyles(optionIds('outfitStyle') as readonly string[])
      : (optionIds(def.key) as readonly string[]);
  return ids.map((id) => ({
    value: id as string,
    label: avatarOptionLabel(def.key, id as never),
    swatch: def.swatchPrefix ? `var(${def.swatchPrefix}${id})` : undefined,
  }));
}

/** The selected id for a group. Gender is optional in the data and reads as Neutral when missing. */
function groupValue(config: AvatarConfig, key: AvatarOptionKey): string {
  return key === 'gender' ? selectedGender(config) : (config[key] as string);
}

/**
 * Step 3: style the Guide and the Visitor (FR-13 to FR-15, design spec 9.4). Every option is a
 * labelled control beside a live 3D preview slot. Changes apply at once; there is no Apply button.
 */
export function CharactersStep() {
  const guide = useBuilderStore((state) => state.guideAvatar);
  const visitor = useBuilderStore((state) => state.visitorAvatar);
  const guideName = useBuilderStore((state) => state.guideName);
  const visitorName = useBuilderStore((state) => state.visitorName);
  const setAvatarOption = useBuilderStore((state) => state.setAvatarOption);
  // faceShape and outfitPattern are real keys of the draft (ADR 0021); the builder's own option
  // type does not list them yet, so they go through this loosely typed view of the same action.
  const setOptional = setAvatarOption as unknown as (
    role: AvatarRole,
    key: 'faceShape' | 'outfitPattern' | 'outfitStyle',
    value: string,
  ) => void;
  const resetAvatar = useBuilderStore((state) => state.resetAvatar);

  const [role, setRole] = useState<AvatarRole>('guide');
  const [section, setSection] = useState<Section>('body');
  const [yaw, setYaw] = useState(0);
  // Open state of More options is kept per character and tab, in memory only (design spec 12.5.3).
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const wide = useMediaQuery('(min-width: 1024px)');

  const config: AvatarConfig = role === 'guide' ? guide : visitor;
  const previewLabel = useMemo(
    () =>
      `${describeAvatar(guide, guideName.trim() || 'Guide')} ${describeAvatar(visitor, visitorName.trim() || 'Visitor')}`,
    [guideName, guide, visitorName, visitor],
  );
  // The text alternative is announced after changes settle, so typing through options is not noisy.
  const guideText = describeAvatar(guide, guideName.trim() || 'Guide');
  const visitorText = describeAvatar(visitor, visitorName.trim() || 'Visitor');
  const [changed, setChanged] = useState<{ guide: string; visitor: string; role: AvatarRole }>({
    guide: guideText,
    visitor: visitorText,
    role: 'guide',
  });
  if (changed.guide !== guideText || changed.visitor !== visitorText) {
    // Only the character that changed is announced, to keep screen reader chatter low (spec 9.4).
    setChanged({
      guide: guideText,
      visitor: visitorText,
      role: changed.guide !== guideText ? 'guide' : 'visitor',
    });
  }
  const announced = useDebouncedValue(changed.role === 'guide' ? guideText : visitorText, 400);

  const groups = GROUPS[section];
  const backView = yaw === BACK_VIEW_DEGREES;

  const offeredStyles = optionIds('outfitStyle') as readonly string[];
  const newStyles = moreStyles(offeredStyles);
  const hasMore = tabHasMoreOptions(section);
  const changedMore = changedInMoreOptions(section, config);
  const openKey = `${role}:${section}`;
  // Opens by itself when any value inside is not its default, including a saved new style.
  if (hasMore && openMap[openKey] === undefined && changedMore > 0) {
    setOpenMap({ ...openMap, [openKey]: true });
  }
  const moreOpen = hasMore && (openMap[openKey] ?? changedMore > 0);
  const outfitColorVar = `var(--avatar-outfit-${config.outfitColor})`;
  const activeStyle = config.outfitStyle as string;
  const activeName = (role === 'guide' ? guideName : visitorName).trim();
  const activeDescription = describeAvatar(
    config,
    activeName || (role === 'guide' ? 'Guide' : 'Visitor'),
  );

  const resetButton = (
    <Button
      variant="tertiary"
      icon="reset"
      className="characters__reset"
      onClick={() => resetAvatar(role)}
    >
      <span className="characters__reset-short" aria-hidden="true">
        Reset
      </span>
      <span className="characters__reset-long">
        Reset {role === 'guide' ? 'Guide' : 'Visitor'} to the starting look
      </span>
    </Button>
  );

  const description = (
    <p className="preview-slot__description">{activeDescription}</p>
  );

  return (
    <div className="characters">
      <div className="characters__preview">
        <AvatarPreviewSlot
          guide={guide}
          visitor={visitor}
          guideName={guideName}
          visitorName={visitorName}
          active={role}
          label={previewLabel}
          yawDegrees={yaw}
          onSelectActive={setRole}
          controls={
            <div className="preview-controls" role="group" aria-label="Turn the preview">
              <Button
                variant="tertiary"
                icon="turnLeft"
                onClick={() => setYaw((value) => (value - TURN_STEP_DEGREES + 360) % 360)}
              >
                Turn left
              </Button>
              <Button
                variant="tertiary"
                icon="turnRight"
                onClick={() => setYaw((value) => (value + TURN_STEP_DEGREES) % 360)}
              >
                Turn right
              </Button>
              <Button
                variant="tertiary"
                icon="reset"
                onClick={() => setYaw(backView ? 0 : BACK_VIEW_DEGREES)}
              >
                {backView ? 'Front view' : 'Back view'}
              </Button>
            </div>
          }
          descriptions={wide ? description : null}
        />
      </div>

      <div className="characters__controls stack">
        <Tabs<AvatarRole>
          label="Character"
          idPrefix="character"
          panelId="character-panel"
          value={role}
          onChange={setRole}
          tabs={[
            { id: 'guide', label: `Guide${guideName.trim() ? `: ${guideName.trim()}` : ''}` },
            {
              id: 'visitor',
              label: `Visitor${visitorName.trim() ? `: ${visitorName.trim()}` : ''}`,
            },
          ]}
        />
        <p className="characters__role-line muted">{CHARACTERS_ROLE_LINE}</p>
        <div
          role="tabpanel"
          id="character-panel"
          aria-labelledby={`character-tab-${role}`}
          className="stack"
        >
          <Tabs<Section>
            label="Appearance"
            idPrefix="section"
            value={section}
            onChange={setSection}
            tabs={SECTIONS.map((item) => ({ id: item.id, label: item.label }))}
          />

          <p className="visually-hidden" role="status">
            {announced}
          </p>
          {wide ? null : description}

          <div
            role="tabpanel"
            id={`section-panel-${section}`}
            aria-labelledby={`section-tab-${section}`}
            className="stack"
          >
            {groups.map((group) => (
              <RadioGroup<string>
                key={`${role}-${group.key}`}
                label={group.label}
                variant={group.variant}
                showValue={group.variant === 'swatches'}
                description={group.description}
                className={group.className}
                options={optionsFor(group)}
                value={groupValue(config, group.key)}
                onChange={(value) => setAvatarOption(role, group.key, value as never)}
              />
            ))}
          </div>

          <MoreOptions
            available={hasMore}
            open={moreOpen}
            onToggle={() => setOpenMap({ ...openMap, [openKey]: !moreOpen })}
            changed={changedMore}
            reset={resetButton}
          >
            {section === 'face' ? (
              <RadioGroup<string>
                key={`${role}-faceShape`}
                label={FACE_SHAPE_GROUP}
                variant="tiles"
                description={FACE_SHAPE_HELPER}
                className="radio-group--face-shape"
                options={faceShapeIds().map((id) => ({
                  value: id,
                  label: FACE_SHAPE_LABELS[id],
                  glyph: <FaceShapeGlyph shape={id} />,
                }))}
                value={avatarFaceShape(config)}
                onChange={(value) => setOptional(role, 'faceShape', value)}
              />
            ) : null}
            {section === 'outfit' && newStyles.length > 0 ? (
              <RadioGroup<string>
                key={`${role}-more-styles`}
                label={MORE_STYLES_GROUP}
                variant="tiles"
                className="radio-group--more-styles"
                options={newStyles.map((id) => ({
                  value: id,
                  label: avatarOptionLabel('outfitStyle', id as AvatarConfig['outfitStyle']),
                  swatch: outfitColorVar,
                  glyph: <GarmentGlyph style={id} />,
                }))}
                value={newStyles.includes(activeStyle) ? activeStyle : ''}
                onChange={(value) => setOptional(role, 'outfitStyle', value)}
              />
            ) : null}
            {section === 'outfit' ? (
              <RadioGroup<string>
                key={`${role}-pattern`}
                label={PATTERN_GROUP}
                variant="tiles"
                description={PATTERN_HELPER}
                className="radio-group--pattern"
                options={patternIds().map((id) => ({
                  value: id,
                  label: PATTERN_LABELS[id],
                  swatch: outfitColorVar,
                  glyph: <PatternGlyph pattern={id} />,
                }))}
                value={avatarOutfitPattern(config)}
                onChange={(value) => setOptional(role, 'outfitPattern', value)}
              />
            ) : null}
          </MoreOptions>
        </div>
      </div>
    </div>
  );
}
