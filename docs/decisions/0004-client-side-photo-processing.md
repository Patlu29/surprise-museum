# 0004: Process photos in the browser and verify them on the server

## Status
Accepted (27/10/2026)

## Context
Photos must be resized to 2048 px at most, have all metadata (including GPS) removed before storage (FR-10), and HEIC must be accepted (FR-2). Sources can be up to 15 MB. Supabase Edge Functions have tight CPU and memory limits that cannot reliably decode and resize large HEIC files; Supabase image transformations need a paid plan and transform on delivery, so the original with metadata would still be stored. Publishing 20 photos must finish within 90 seconds on 4G (NFR-18).

## Decision
- Decode, resize and re-encode in the browser (`src/media`), in a Web Worker with `OffscreenCanvas` where available. Re-encoding through a canvas produces a fresh JPEG with no EXIF, GPS, XMP or IPTC.
- Apply EXIF orientation at decode (`imageOrientation: 'from-image'`) before it is stripped.
- Never allocate a canvas above 4096 px on the long edge (iOS canvas area limit).
- HEIC: Safari decodes natively. Elsewhere, lazily import `heic-to/csp` (libheif WASM, about 3 MB, CSP-safe build) only when a HEIC file fails native decoding.
- Output JPEG only (Safari cannot reliably encode WebP from a canvas).
- The server's `confirm-photo` verifies by reading bytes, not decoding: JPEG magic number, no APP1 or APP13 segments, and frame dimensions within limits.

## Consequences
- Uploads are about 0.8 MB per photo instead of up to 15 MB, so NFR-18 is comfortable.
- A tampered client still cannot store metadata, because the server rejects it.
- Wide-gamut (Display P3) photos are converted to sRGB; a slight colour shift is acceptable.
- `heic-to` is LGPL-3.0. Keeping it as a separate lazy chunk keeps it replaceable, but legal must confirm.
- The builder needs real-device testing on iPhones with 24 and 48 MP photos.
