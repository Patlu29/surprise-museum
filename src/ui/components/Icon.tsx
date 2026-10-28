import type { SVGProps } from 'react';

/**
 * Small stroke icons, 24 by 24. They are decorative (`aria-hidden`): every icon sits beside a
 * visible label or inside a button that carries an `aria-label`. Colour comes from the text colour.
 */
const PATHS = {
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17.2v.1',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v5M12 7.8v.1',
  grip: 'M9 6v.01M15 6v.01M9 12v.01M15 12v.01M9 18v.01M15 18v.01',
  copy: 'M8 8h11v12H8zM5 16V4h11',
  share: 'M12 15V4M8 8l4-4 4 4M5 13v7h14v-7',
  compass: 'M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5 5-2z',
  settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6',
  help: 'M12 3a9 9 0 100 18 9 9 0 000-18zM9.500 9.500a2.500 2.500 0 114 2c-.8.600-1.500 1-1.500 2M12 16.800v.1',
  list: 'M9 6h11M9 12h11M9 18h11M4.500 6v.01M4.500 12v.01M4.500 18v.01',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  left: 'M19 12H5M11 6l-6 6 6 6',
  right: 'M5 12h14M13 6l6 6-6 6',
  turnLeft: 'M9 5L5 9l4 4M5 9h9a5 5 0 010 10h-3',
  turnRight: 'M15 5l4 4-4 4M19 9h-9a5 5 0 000 10h3',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  reset: 'M4 12a8 8 0 108-8H8M8 4L5 7l3 3',
  heart: 'M12 20s-7-4.500-7-10a4 4 0 017-2.500A4 4 0 0119 10c0 5.500-7 10-7 10z',
  retry: 'M20 12a8 8 0 11-2.500-5.800M20 4v5h-5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H5V7h6',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6',
  eye: 'M3 12s3.500-6 9-6 9 6 9 6-3.500 6-9 6-9-6-9-6zM12 9.500a2.500 2.500 0 100 5 2.500 2.500 0 000-5z',
  sparkle: 'M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800L12 3z',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: 'sm' | 'md' | 'lg';
}

export function Icon({ name, size = 'md', className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={['icon', `icon--${size}`, className].filter(Boolean).join(' ')}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
