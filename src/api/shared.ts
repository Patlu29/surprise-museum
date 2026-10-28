/**
 * Server-side rules that the mock API reuses, so the mock accepts and rejects exactly what the
 * Edge Functions do. These files are pure TypeScript with no Deno or Node APIs.
 * (No file extension in the paths: Vite and tsc resolve them, and the files import nothing but
 * the contract.)
 */
export {
  checkJpeg,
  checkLqipDataUrl,
  JPEG_REJECTION_MESSAGES,
} from '../../supabase/functions/_shared/jpeg';
export {
  base64UrlEncode,
  bytesToHex,
  createTokenPair,
  deriveShareToken,
  hashToken,
  isShareToken,
} from '../../supabase/functions/_shared/tokens';
export {
  FULL_RENDITION,
  parseManageRequest,
  proportionsMatch,
  WALL_RENDITION,
} from '../../supabase/functions/_shared/validate';
