# 0002: Host on GitHub Pages and use hash routing

## Status
Accepted (27/10/2026)

## Context
The user chose GitHub Pages for the frontend, served from the project path `https://patlu29.github.io/surprise-museum/`. Pages serves static files only: it cannot rewrite unknown paths to `index.html` and cannot set response headers. Share and edit links carry secret tokens and are opened from messaging apps. Two deep-link options exist:
1. Path routing with a `404.html` that redirects to `index.html` (the "spa-github-pages" trick). Links look clean, but every deep link first returns HTTP 404, the token travels to GitHub's servers in the request path, some in-app browsers and link previewers treat the 404 as an error, and the redirect costs a round trip.
2. Hash routing (`/surprise-museum/#/m/<token>`). Browsers never send the fragment to the server.

## Decision
- Use hash routing with `wouter` (about 2 kB, `wouter/use-hash-location`), not React Router.
- Vite `base` is `/surprise-museum/`. Add `public/.nojekyll`.
- Because Pages cannot set headers, inject a Content-Security-Policy `<meta>` (and a `preconnect` to Supabase) into the production build from `vite.config.ts`, and set `robots` `noindex` and `referrer` `no-referrer` metas in `index.html`.

## Consequences
- Tokens never reach GitHub Pages, its logs, or a `Referer` header. Link previews only see the generic Open Graph tags.
- No 404 round trip, so the welcome screen appears sooner (NFR-2).
- Links contain `#/`, which looks slightly less tidy.
- A meta CSP cannot set `frame-ancestors`; the edit route needs a JavaScript frame check.
- A future custom domain at the root would change `base` to `/` and nothing else.
