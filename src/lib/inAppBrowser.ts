/**
 * Detects the built-in browsers of common messaging and social apps (NFR-9). They often limit
 * WebGL, memory and file access, so the welcome screen offers an "Open in your browser" hint.
 * Detection is a best-effort hint, never a gate.
 */
const IN_APP_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/FBAN|FBAV|FB_IAB/i, 'Facebook'],
  [/(?<!Micro)Messenger/i, 'Messenger'],
  [/Instagram/i, 'Instagram'],
  [/WhatsApp/i, 'WhatsApp'],
  [/Snapchat/i, 'Snapchat'],
  [/TikTok|musical_ly|BytedanceWebview/i, 'TikTok'],
  [/MicroMessenger/i, 'WeChat'],
  [/\bLine\//i, 'LINE'],
  [/LinkedInApp/i, 'LinkedIn'],
  [/Pinterest/i, 'Pinterest'],
  [/Twitter|TwitterAndroid/i, 'X'],
];

export function detectInAppBrowser(userAgent: string): string | null {
  for (const [pattern, name] of IN_APP_PATTERNS) {
    if (pattern.test(userAgent)) return name;
  }
  return null;
}
