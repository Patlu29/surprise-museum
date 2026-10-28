import { useMemo, useState } from 'react';
import type { AvatarConfig } from '@contract';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { AvatarOptionKey, AvatarRole } from '@/lib/avatars';
import { avatarOptionLabel, describeAvatar, optionIds } from '@/lib/avatars';
import { useBuilderStore } from '@/state/builderStore';
import { Button } from '@/ui/components/Button';
import { RadioGroup, type RadioOption } from '@/ui/components/RadioGroup';
import { Tabs } from '@/ui/components/Tabs';
import { AvatarPreviewSlot } from './AvatarPreviewSlot';

type Section = 'face' | 'hair' | 'outfit' | 'body';

const SECTIONS: ReadonlyArray<{ id: Section; label: string }> = [
  { id: 'face', label: 'Face' },
  { id: 'hair', label: 'Hair' },
  { id: 'outfit', label: 'Outfit' },
  { id: 'body', label: 'Body' },
];

const TURN_STEP_DEGREES = 30;
const BACK_VIEW_DEGREES = 180;

/** Every option in the customiser is one of these: a labelled radiogroup (design spec 5.3). */
interface GroupDef {
  key: AvatarOptionKey;
  label: string;
  variant: 'tiles' | 'swatches';
  /** CSS custom property prefix for swatch colours, from tokens.css. */
  swatchPrefix?: string;
  guideOnly?: boolean;
}

const GROUPS: Record<Section, GroupDef[]> = {
  face: [
    { key: 'skinTone', label: 'Skin tone', variant: 'swatches', swatchPrefix: '--avatar-' },
    { key: 'facialHair', label: 'Facial hair', variant: 'tiles', guideOnly: true },
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
    { key: 'bodyType', label: 'Body type', variant: 'tiles' },
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
  const [section, setSection] = useState<Section>('face');
  const [yaw, setYaw] = useState(0);

  const config: AvatarConfig = role === 'guide' ? guide : visitor;
  const description = useMemo(
    () =>
      `${describeAvatar(guide, guideName.trim() || 'Guide')} ${describeAvatar(visitor, visitorName.trim() || 'Visitor')}`,
    [guideName, guide, visitorName, visitor],
  );
  // The text alternative is announced after changes settle, so typing through options is not noisy.
  const announced = useDebouncedValue(description, 400);

  const groups = GROUPS[section].filter((group) => !(group.guideOnly && role !== 'guide'));
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
              options={optionsFor(group)}
              value={config[group.key] as string}
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
  );
}
