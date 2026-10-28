import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { KEY_YAW_RATE } from '@/hooks/keyboardIntent';
import { setMoveSource, setOrbitRate } from '@/state/inputState';
import type { IconName } from '@/ui/components/Icon';
import { Icon } from '@/ui/components/Icon';

type Direction = 'forward' | 'back' | 'left' | 'right' | 'turn-left' | 'turn-right';

const BUTTONS: ReadonlyArray<{ id: Direction; icon: IconName; label: string; area: string }> = [
  { id: 'forward', icon: 'up', label: 'Walk forward', area: 'up' },
  { id: 'left', icon: 'left', label: 'Walk left', area: 'left' },
  { id: 'right', icon: 'right', label: 'Walk right', area: 'right' },
  { id: 'back', icon: 'down', label: 'Walk back', area: 'down' },
  { id: 'turn-left', icon: 'turnLeft', label: 'Turn view left', area: 'turn-left' },
  { id: 'turn-right', icon: 'turnRight', label: 'Turn view right', area: 'turn-right' },
];

/**
 * Press-and-hold arrow buttons: the non-drag alternative to the joystick and to drag-to-look
 * (WCAG 2.5.7, an MVP Must). Each button is a real <button>, so touch, mouse, keyboard and
 * switch users can all hold it (Space or Enter held down).
 */
export function ArrowPad() {
  const held = useRef(new Set<Direction>());

  const apply = () => {
    const set = held.current;
    const x = (set.has('right') ? 1 : 0) - (set.has('left') ? 1 : 0);
    const y = (set.has('forward') ? 1 : 0) - (set.has('back') ? 1 : 0);
    setMoveSource('arrows', x, y);
    const yaw = ((set.has('turn-right') ? 1 : 0) - (set.has('turn-left') ? 1 : 0)) * KEY_YAW_RATE;
    setOrbitRate('buttons', yaw, 0);
  };
  const press = (id: Direction) => {
    held.current.add(id);
    apply();
  };
  const release = (id: Direction) => {
    held.current.delete(id);
    apply();
  };

  useEffect(() => {
    const set = held.current;
    return () => {
      set.clear();
      setMoveSource('arrows', 0, 0);
      setOrbitRate('buttons', 0, 0);
    };
  }, []);

  return (
    <div className="arrow-pad ui-hit" role="group" aria-label="Move and turn">
      {BUTTONS.map((button) => (
        <button
          key={button.id}
          type="button"
          className="arrow-pad__button ui-gesture"
          style={{ gridArea: button.area }}
          aria-label={button.label}
          onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            press(button.id);
          }}
          onPointerUp={() => release(button.id)}
          onPointerCancel={() => release(button.id)}
          onLostPointerCapture={() => release(button.id)}
          onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
            if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
              event.preventDefault();
              press(button.id);
            }
          }}
          onKeyUp={(event: KeyboardEvent<HTMLButtonElement>) => {
            if (event.key === ' ' || event.key === 'Enter') release(button.id);
          }}
          onBlur={() => release(button.id)}
          onContextMenu={(event) => event.preventDefault()}
        >
          <Icon name={button.icon} />
        </button>
      ))}
    </div>
  );
}
