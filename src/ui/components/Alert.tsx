import type { ReactNode } from 'react';
import type { IconName } from './Icon';
import { Icon } from './Icon';

export type AlertTone = 'info' | 'warning' | 'danger' | 'success';

const ICONS: Record<AlertTone, IconName> = {
  info: 'info',
  warning: 'alert',
  danger: 'alert',
  success: 'check',
};

interface AlertProps {
  tone: AlertTone;
  /** Bold lead-in, so meaning never depends on colour alone. */
  title?: string;
  children?: ReactNode;
  /** Errors use `alert`; progress and success use `status` (design spec 5.14). */
  role?: 'alert' | 'status' | 'none';
  onDismiss?: () => void;
  id?: string;
  className?: string;
  tabIndex?: number;
  headingRef?: (element: HTMLDivElement | null) => void;
}

export function Alert({
  tone,
  title,
  children,
  role,
  onDismiss,
  id,
  className,
  tabIndex,
  headingRef,
}: AlertProps) {
  const resolvedRole = role ?? (tone === 'danger' ? 'alert' : 'status');
  return (
    <div
      id={id}
      ref={headingRef}
      tabIndex={tabIndex}
      role={resolvedRole === 'none' ? undefined : resolvedRole}
      className={['alert', `alert--${tone}`, className].filter(Boolean).join(' ')}
    >
      <Icon name={ICONS[tone]} className="alert__icon" />
      <div className="alert__body">
        {title ? <p className="alert__title">{title}</p> : null}
        {children}
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="btn btn--tertiary btn--icon"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <Icon name="close" />
        </button>
      ) : null}
    </div>
  );
}
