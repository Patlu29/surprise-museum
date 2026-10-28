interface ProgressBarProps {
  /** 0 to 1, or null for an indeterminate sweep (static under reduced motion). */
  value: number | null;
  label: string;
  className?: string;
}

export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const percent = value === null ? undefined : Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={['progress', value === null && 'progress--indeterminate', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className="progress__fill"
        style={percent === undefined ? undefined : { width: `${percent}%` }}
      />
    </div>
  );
}
