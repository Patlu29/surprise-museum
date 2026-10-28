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
