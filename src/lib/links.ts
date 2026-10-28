import { EDIT_TOKEN_PATTERN, ROUTES, SHARE_TOKEN_PATTERN } from '@contract';

/** Joins the app's base URL and a hash route, for example `https://host/surprise-museum/#/m/abc`. */
export function buildHashUrl(baseUrl: string, route: string): string {
  const base = baseUrl.split('#')[0] ?? baseUrl;
  return `${base}#${route}`;
}

/** The public base URL of the app, including the Vite base path. */
export function appBaseUrl(): string {
  if (typeof window === 'undefined') return import.meta.env.BASE_URL;
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}

export function shareUrl(shareToken: string, baseUrl: string = appBaseUrl()): string {
  return buildHashUrl(baseUrl, ROUTES.visit(shareToken));
}

export function editUrl(editToken: string, baseUrl: string = appBaseUrl()): string {
  return buildHashUrl(baseUrl, ROUTES.edit(editToken));
}

export function isShareToken(value: string | undefined): value is string {
  return typeof value === 'string' && SHARE_TOKEN_PATTERN.test(value);
}

export function isEditToken(value: string | undefined): value is string {
  return typeof value === 'string' && EDIT_TOKEN_PATTERN.test(value);
}

export const REPORT_PROBLEM_URL = 'https://github.com/Patlu29/surprise-museum/issues';
