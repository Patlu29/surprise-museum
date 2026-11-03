import { useId, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  /** A CSS colour or token reference, for swatches: `var(--avatar-skin-01)`. */
  swatch?: string;
  /** A decorative pictogram or fabric swatch shown with the label (design spec 12.5.3). */
  glyph?: ReactNode;
}

interface RadioGroupProps<T extends string> {
  label: string;
  options: ReadonlyArray<RadioOption<T>>;
  value: T;
  onChange: (value: T) => void;
  variant?: 'tiles' | 'swatches' | 'segmented';
  /** Show the selected option's name after the group label ("Hair colour: Auburn"). */
  showValue?: boolean;
  /** Hide the visible label (the group keeps its accessible name). */
  labelHidden?: boolean;
  /** Helper text shown below the options and linked with `aria-describedby`. */
  description?: string;
  className?: string;
}

/**
 * A radiogroup with roving tabindex: arrow keys move and select, Tab leaves the group
 * (design spec 5.3). Selected options show a check mark and a ring, never colour alone.
 * Used for tiles, colour swatches and segmented controls.
 */
export function RadioGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  variant = 'tiles',
  showValue,
  labelHidden,
  description,
  className,
}: RadioGroupProps<T>) {
  const labelId = useId();
  const descriptionId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const foundIndex = options.findIndex((option) => option.value === value);
  const selectedIndex = Math.max(0, foundIndex);
  const selected = options[selectedIndex];
  // With nothing selected (a group that shares its value with another group) the first option is the tab stop.
  const tabStop = foundIndex >= 0 ? foundIndex : 0;

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % options.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + options.length) % options.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      className={['radio-group', `radio-group--${variant}`, className].filter(Boolean).join(' ')}
    >
      <p id={labelId} className={labelHidden ? 'visually-hidden' : 'radio-group__label'}>
        {label}
        {showValue && selected && foundIndex >= 0 ? (
          <span className="radio-group__value">: {selected.label}</span>
        ) : null}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        className="radio-group__options"
      >
        {options.map((option, index) => {
          const checked = option.value === value;
          const style = option.swatch
            ? ({ '--swatch': option.swatch } as CSSProperties)
            : undefined;
          return (
            <button
              key={option.value}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="button"
              role="radio"
              value={option.value}
              aria-checked={checked}
              aria-label={variant === 'swatches' ? option.label : undefined}
              tabIndex={index === tabStop ? 0 : -1}
              className={['radio-option', checked && 'is-selected'].filter(Boolean).join(' ')}
              style={style}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => move(event, index)}
            >
              {variant === 'swatches' ? (
                <span className="radio-option__swatch" aria-hidden="true">
                  {checked ? <Icon name="check" size="sm" /> : null}
                </span>
              ) : (
                <>
                  {option.glyph ? <span className="radio-option__glyph">{option.glyph}</span> : null}
                  {checked ? <Icon name="check" size="sm" /> : null}
                  <span>{option.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      {description ? (
        <p id={descriptionId} className="radio-group__help">
          {description}
        </p>
      ) : null}
    </div>
  );
}
