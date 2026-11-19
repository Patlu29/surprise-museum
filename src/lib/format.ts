/** A byte count for people: "0 B", "512 KB", "2.4 MB". Binary units, Australian number format. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  const text = value.toLocaleString('en-AU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
  return `${text} ${units[unit]}`;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * An ISO instant as "DD/MM/YYYY HH:mm" in the viewer's local time, 24-hour and zero-padded
 * (architecture 8.1). Built from the Date getters, not `toLocaleString`, so the output does not
 * depend on the browser's locale. Returns null for a missing or unparseable value.
 */
export function formatEndDateTime(iso: string | null | undefined): string | null {
  if (typeof iso !== 'string' || iso === '') return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const time = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  return `${day}/${month}/${date.getFullYear()} ${time}`;
}
