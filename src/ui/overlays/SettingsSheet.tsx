import type {
  CaptionSize,
  ControlsSetting,
  JoystickSide,
  MotionSetting,
  QualitySetting,
} from '@/state/settingsStore';
import { useSettingsStore } from '@/state/settingsStore';
import { Button } from '@/ui/components/Button';
import { RadioGroup } from '@/ui/components/RadioGroup';
import { Sheet } from '@/ui/components/Sheet';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenHelp: () => void;
}

/** Visitor settings (design spec 5.13). Changes apply at once and persist in localStorage. */
export function SettingsSheet({ open, onClose, onOpenHelp }: SettingsSheetProps) {
  const settings = useSettingsStore();

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      <RadioGroup<CaptionSize>
        label="Caption text size"
        variant="segmented"
        value={settings.captionSize}
        onChange={settings.setCaptionSize}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'large', label: 'Large' },
          { value: 'xlarge', label: 'Extra large' },
        ]}
      />
      <RadioGroup<MotionSetting>
        label="Motion"
        variant="segmented"
        value={settings.motion}
        onChange={settings.setMotion}
        options={[
          { value: 'system', label: 'Follow my device' },
          { value: 'reduce', label: 'Reduce' },
          { value: 'full', label: 'Full' },
        ]}
      />
      <RadioGroup<ControlsSetting>
        label="Controls"
        variant="segmented"
        value={settings.controls}
        onChange={settings.setControls}
        options={[
          { value: 'auto', label: 'Automatic' },
          { value: 'joystick', label: 'Joystick' },
          { value: 'arrows', label: 'Arrow buttons' },
        ]}
      />
      <RadioGroup<JoystickSide>
        label="Controls side"
        variant="segmented"
        value={settings.joystickSide}
        onChange={settings.setJoystickSide}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ]}
      />
      <RadioGroup<QualitySetting>
        label="Graphics"
        variant="segmented"
        value={settings.quality}
        onChange={settings.setQuality}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'low', label: 'Low' },
        ]}
      />
      <Button
        variant="secondary"
        icon="help"
        onClick={() => {
          onClose();
          onOpenHelp();
        }}
      >
        How to explore
      </Button>
    </Sheet>
  );
}
