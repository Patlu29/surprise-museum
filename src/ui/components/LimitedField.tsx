import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { codePointLength, limitText } from '@/lib/text';
import { Icon } from './Icon';

interface LimitedFieldProps {
  /** The DOM id. Error summaries focus the control by this id. */
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Maximum length in Unicode code points (an emoji counts as one). */
  max: number;
  multiline?: boolean;
  rows?: number;
  helper?: ReactNode;
  error?: string | null;
  required?: boolean;
  autoCapitalize?: 'words' | 'sentences' | 'none';
  lang?: string;
  spellCheck?: boolean;
  showCounter?: boolean;
  className?: string;
  /** Shown while the field is empty. Never a replacement for the label (design spec 12.5.2). */
  placeholder?: string;
  /** Called when the field loses focus (blur validation, design spec 12.4.5). */
  onFieldBlur?: () => void;
  onFieldFocus?: () => void;
  /** A multiline field grows with its text up to this many rows, then scrolls (design spec 12.5.1). */
  maxRows?: number;
}

/**
 * A text field with a visible label, helper text, a code point counter and a limit message
 * (design spec 5.2). The limit is enforced in code, never with the native `maxlength`, which
 * counts UTF-16 units. Input stops at the limit and a status message says so (US-3, US-4).
 */
export function LimitedField({
  id,
  label,
  value,
  onChange,
  max,
  multiline,
  rows = 3,
  helper,
  error,
  required,
  autoCapitalize = 'sentences',
  lang,
  spellCheck,
  showCounter = true,
  className,
  placeholder,
  onFieldBlur,
  onFieldFocus,
  maxRows,
}: LimitedFieldProps) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [atLimit, setAtLimit] = useState(false);
  const generated = useId();
  const helperId = `${id}-help`;
  const errorId = `${id}-error`;
  const limitId = `${id}-limit-${generated}`;
  const describedBy = [helper ? helperId : null, error ? errorId : null, atLimit ? limitId : null]
    .filter(Boolean)
    .join(' ');

  // Auto-grow: fit the text, never above `maxRows`, then scroll inside the field.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el || !maxRows) return;
    el.style.height = 'auto';
    const style = getComputedStyle(el);
    const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
    const chrome =
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      parseFloat(style.borderTopWidth) +
      parseFloat(style.borderBottomWidth);
    const limit = line * maxRows + chrome;
    el.style.height = `${Math.min(el.scrollHeight + (el.offsetHeight - el.clientHeight), limit)}px`;
    el.style.overflowY = el.scrollHeight + 1 > limit ? 'auto' : 'hidden';
  }, [value, maxRows]);

  const handleChange = (next: string) => {
    const result = limitText(next, max);
    setAtLimit(result.truncated || codePointLength(result.value) >= max);
    onChange(result.value);
  };

  const sharedProps = {
    id,
    value,
    required,
    lang,
    spellCheck,
    autoCapitalize,
    autoComplete: 'off',
    placeholder,
    onBlur: onFieldBlur,
    onFocus: onFieldFocus,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
    className: 'field__control',
  };

  return (
    <div className={['field', error && 'field--error', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className="field__label">
        {label}
        {required ? <span className="field__required"> (required)</span> : null}
      </label>
      {multiline ? (
        <textarea
          {...sharedProps}
          ref={areaRef}
          className={maxRows ? 'field__control field__control--grow' : 'field__control'}
          rows={rows}
          onChange={(event) => handleChange(event.target.value)}
        />
      ) : (
        <input
          {...sharedProps}
          type="text"
          onChange={(event) => handleChange(event.target.value)}
        />
      )}
      <div className="field__meta">
        <div className="field__messages">
          {helper ? (
            <p id={helperId} className="field__helper">
              {helper}
            </p>
          ) : null}
          {error ? (
            <p id={errorId} className="field__error">
              <Icon name="alert" size="sm" /> {error}
            </p>
          ) : null}
          <p id={limitId} role="status" className="field__limit">
            {atLimit ? `That is the limit: ${max.toLocaleString('en-AU')} characters` : ''}
          </p>
        </div>
        {showCounter ? (
          <p className="field__counter" aria-hidden="true">
            {codePointLength(value).toLocaleString('en-AU')} / {max.toLocaleString('en-AU')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
