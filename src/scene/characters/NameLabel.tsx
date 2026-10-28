import { Html } from '@react-three/drei';
import type { CharacterRole } from '@/domain/characters/characterState';

/**
 * Floating name label (FR-17, ADR 0011, design spec 5.5). A DOM element anchored above the head
 * with drei Html. It never intercepts pointer events, sits below every panel (zIndexRange 5 to 0),
 * and is aria-hidden: names are announced by the UI instead. Opacity is driven from the character
 * view each frame (wall line of sight, relocate fade), by writing to the element directly.
 * Names render exactly as typed, including accents and emoji.
 */
interface NameLabelProps {
  role: CharacterRole;
  name: string;
  /** Height of the label above the feet in metres (0.35 m above the head, scaled with height). */
  labelHeight: number;
  register: (element: HTMLElement | null) => void;
}

export function NameLabel({ role, name, labelHeight, register }: NameLabelProps) {
  return (
    <Html
      position={[0, labelHeight, 0]}
      center
      zIndexRange={[5, 0]}
      pointerEvents="none"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <NameLabelPill role={role} name={name} register={register} />
    </Html>
  );
}

/**
 * The label's visual: a solid pill with a role marker, sized to its text. Shared by the museum's
 * Html labels and the builder preview's overlay labels, so the Creator sees exactly what the
 * Visitor will see (US-7).
 */
export function NameLabelPill({
  role,
  name,
  register,
}: {
  role: CharacterRole;
  name: string;
  register?: (element: HTMLElement | null) => void;
}) {
  return (
    <div
      ref={register}
      aria-hidden="true"
      data-testid={`name-label-${role}`}
      className="scene-name-label user-text"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxSizing: 'border-box',
        // Size to the text, then clamp: without this the label collapses to a column of letters
        // when it sits near the right edge of its absolutely positioned wrapper.
        width: 'max-content',
        maxWidth: 'min(var(--label-max-width, 11rem), 44vw)',
        padding: 'var(--label-padding-y, 6px) var(--label-padding-x, 12px)',
        background: 'var(--label-bg, #1f1620)',
        color: 'var(--label-fg, #fbf6ee)',
        border: 'var(--label-ring-width, 1.5px) solid var(--label-ring, rgba(251,246,238,0.92))',
        borderRadius: 'var(--radius-pill, 999px)',
        boxShadow: 'var(--shadow-label, 0 2px 6px rgba(0,0,0,0.35))',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        fontSize: 'var(--label-font-size, 0.9375rem)',
        fontWeight: 600,
        lineHeight: 'var(--leading-tight, 1.2)',
        overflowWrap: 'anywhere',
        whiteSpace: 'normal',
        pointerEvents: 'none',
        userSelect: 'none',
        transition:
          'opacity var(--duration-fast, 150ms) ease, translate var(--duration-fast, 150ms) ease',
        opacity: 0,
      }}
    >
      <Marker role={role} />
      <span style={{ minWidth: 0 }}>{name}</span>
    </div>
  );
}

/** Decorative role marker: a heart for the Visitor, a diamond for the Guide. */
function Marker({ role }: { role: CharacterRole }) {
  return role === 'visitor' ? (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}>
      <path
        d="M12 21s-7.5-4.6-9.6-9.1C.8 8.2 3 4.5 6.6 4.5c2 0 3.7 1.1 5.4 3.1 1.7-2 3.4-3.1 5.4-3.1 3.6 0 5.8 3.7 4.2 7.4C19.500 16.400 12 21 12 21z"
        fill="var(--label-dot-visitor, #f0a6b8)"
      />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M12 1l10 11-10 11L2 12z" fill="var(--label-dot-guide, #c9a15b)" />
    </svg>
  );
}
