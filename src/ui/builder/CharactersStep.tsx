import { useMemo, useState } from 'react';
import type { AvatarConfig } from '@contract';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { AvatarOptionKey, AvatarRole } from '@/lib/avatars';
import { avatarOptionLabel, describeAvatar, optionIds, selectedGender } from '@/lib/avatars';
import { useBuilderStore } from '@/state/builderStore';
import { Button } from '@/ui/components/Button';
import { RadioGroup, type RadioOption } from '@/ui/components/RadioGroup';
import { Tabs } from '@/ui/components/Tabs';
import { AvatarPreviewSlot } from './AvatarPreviewSlot';

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
  return optionIds(def.key).map((id) => ({
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
  const resetAvatar = useBuilderStore((state) => state.resetAvatar);

  const [role, setRole] = useState<AvatarRole>('guide');
  const [section, setSection] = useState<Section>('body');
  const [yaw, setYaw] = useState(0);

  const config: AvatarConfig = role === 'guide' ? guide : visitor;
  const description = useMemo(
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

  return (
    <div className="characters">
      <div className="characters__preview">
        <AvatarPreviewSlot
          guide={guide}
          visitor={visitor}
          guideName={guideName}
          visitorName={visitorName}
          active={role}
          label={description}
          yawDegrees={yaw}
          onSelectActive={setRole}
          descriptions={
            <>
              <p className="preview-slot__description">
                {describeAvatar(
                  config,
                  (role === 'guide' ? guideName : visitorName).trim() ||
                    (role === 'guide' ? 'Guide' : 'Visitor'),
                )}
              </p>
              <p className="visually-hidden" role="status">
                {announced}
              </p>
            </>
          }
        />
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

          <div>
            <Button variant="tertiary" icon="reset" onClick={() => resetAvatar(role)}>
              Reset {role === 'guide' ? 'Guide' : 'Visitor'} to the starting look
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
