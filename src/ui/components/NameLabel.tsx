interface NameLabelProps {
  name: string;
  role: 'guide' | 'visitor';
  /** Shown instead of the name while it is empty, in the builder. */
  placeholder?: string;
}

/**
 * The name pill (design spec 5.5) as used in the builder: solid backing, hairline ring, a heart
 * for the Visitor and a diamond for the Guide (decorative). The same look is used over the
 * characters in the scene, so Creators see exactly what the Visitor will see (US-7).
 * The text keeps accents and emoji exactly as typed.
 */
export function NameLabel({ name, role, placeholder }: NameLabelProps) {
  const text = name.trim() || placeholder || '';
  return (
    <span className={`name-label name-label--${role}`}>
      <span className="name-label__marker" aria-hidden="true" />
      <span className="name-label__text user-text">{text}</span>
    </span>
  );
}
