import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { setMoveSource } from '@/state/inputState';
import { readJoystick } from './joystickMath';

function cssNumber(element: Element, name: string, fallback: number): number {
  const value = parseFloat(getComputedStyle(element).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Touch joystick (design spec 5.9). Pointer capture on the hit area, with the pointer id tracked
 * so a second finger can orbit independently. It is a pointer-only enhancement, so it is hidden
 * from assistive technology; the keyboard and the arrow buttons are the accessible paths.
 */
export function Joystick() {
  const hitRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const activeId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [held, setHeld] = useState(false);

  useEffect(() => () => setMoveSource('joystick', 0, 0), []);

  const update = (event: PointerEvent<HTMLDivElement>) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const travel = cssNumber(base, '--joystick-travel', 48);
    const deadZone = cssNumber(base, '--joystick-dead-zone', 0.12);
    const reading = readJoystick(
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2),
      travel,
      deadZone,
    );
    setKnob(reading.knob);
    setMoveSource('joystick', reading.move.x, reading.move.y);
  };

  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activeId.current) return;
    activeId.current = null;
    setHeld(false);
    setKnob({ x: 0, y: 0 });
    setMoveSource('joystick', 0, 0);
  };

  return (
    <div
      ref={hitRef}
      className="joystick ui-hit ui-gesture"
      aria-hidden="true"
      onPointerDown={(event) => {
        if (activeId.current !== null) return;
        activeId.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        setHeld(true);
        update(event);
      }}
      onPointerMove={(event) => {
        if (event.pointerId === activeId.current) update(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div
        ref={baseRef}
        className={['joystick__base', held && 'is-held'].filter(Boolean).join(' ')}
      >
        <span className="joystick__tick joystick__tick--n">N</span>
        <span className="joystick__tick joystick__tick--e">E</span>
        <span className="joystick__tick joystick__tick--s">S</span>
        <span className="joystick__tick joystick__tick--w">W</span>
        <div
          className="joystick__knob"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>
    </div>
  );
}
