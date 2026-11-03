import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'wouter';
import type { IconName } from './Icon';
import { Icon } from './Icon';

export type ButtonVariant =
  'primary' | 'secondary' | 'tertiary' | 'danger' | 'night' | 'night-primary';

interface CommonProps {
  variant?: ButtonVariant;
  /** 56 px calls to action, or the default 44 px. */
  large?: boolean;
  /** 48 px: the builder action bar and other thumb-reach controls (design spec 12.1). */
  medium?: boolean;
  icon?: IconName;
  children?: ReactNode;
}

function classes(
  variant: ButtonVariant,
  large: boolean | undefined,
  iconOnly: boolean,
  extra?: string,
  medium?: boolean,
) {
  return [
    'btn',
    `btn--${variant}`,
    large && 'btn--large',
    medium && !large && 'btn--medium',
    iconOnly && 'btn--icon',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

interface ButtonProps extends CommonProps, ComponentProps<'button'> {
  /** Shows a spinner, sets `aria-busy` and ignores presses (design spec 5.1). */
  loading?: boolean;
  /** Prefer this to `disabled` when the reason is explained nearby (design spec 5.1). */
  unavailable?: boolean;
}

export function Button({
  variant = 'secondary',
  large,
  medium,
  icon,
  loading,
  unavailable,
  className,
  children,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  const iconOnly = !children;
  const blocked = Boolean(loading || unavailable);
  return (
    <button
      type={type}
      className={classes(variant, large, iconOnly, className, medium)}
      aria-busy={loading || undefined}
      aria-disabled={blocked || undefined}
      onClick={(event) => {
        if (blocked) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...rest}
    >
      {loading ? (
        <span className="spinner" aria-hidden="true" />
      ) : icon ? (
        <Icon name={icon} />
      ) : null}
      {children ? <span className="btn__label">{children}</span> : null}
    </button>
  );
}

interface ButtonLinkProps extends CommonProps, Omit<ComponentProps<'a'>, 'href' | 'ref'> {
  /** An in-app route (hash routing) when `external` is false. */
  href: string;
  external?: boolean;
}

/** A link that looks like a button. In-app links use the hash router; external links open safely. */
export function ButtonLink({
  variant = 'secondary',
  large,
  medium,
  icon,
  href,
  external,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const content = (
    <>
      {icon ? <Icon name={icon} /> : null}
      <span className="btn__label">{children}</span>
    </>
  );
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes(variant, large, false, className, medium)}
        {...rest}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={classes(variant, large, false, className, medium)} {...rest}>
      {content}
    </Link>
  );
}
