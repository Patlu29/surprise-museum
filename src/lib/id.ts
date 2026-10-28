let counter = 0;

/** A short id that is unique for the life of the page. Not a secret. */
export function newLocalId(prefix = 'p'): string {
  counter += 1;
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${counter}-${random}`;
}
