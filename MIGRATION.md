# Migration Plan: LegalType Web Keyboard → app.legaltype.com/web-keyboard

**Audience:** LegalType engineering team (India)
**Owner:** daniela@legaltype.com
**Source repo:** https://github.com/getlegaltype/legaltype-web-keyboard
**Target URL:** https://app.legaltype.com/web-keyboard
**Target stack:** Next.js / React SPA (app.legaltype.com)

---

## 1. Context

Today the web keyboard is a static HTML/CSS/JS site that auto-deploys to GitHub Pages on push to `main` (see `.github/workflows/pages.yml`). The current public URL is **legaltype.ai** (set via `CNAME`). All logic lives in three vanilla-JS files plus one CSS file:

```
index.html
assets/css/styles.css
assets/js/app.js          # Bootstraps the app
assets/js/keyboard.js     # Renders the on-screen keyboard, handles key events
assets/js/layouts/legal-en.js  # US QWERTY + AltGr legal-symbol layer
```

There is no build step, no framework, no backend. That is intentional — the keyboard must work on any machine (Chromebook, kiosk, courthouse computer) with no install. Keep that property after the migration.

We want this same keyboard living at `app.legaltype.com/web-keyboard` with:

1. Real SEO (search-indexable, with proper metadata).
2. An efficient way to push future updates.
3. No regression in the no-install / no-tracking behavior.

---

## 2. Recommended approach: port into the Next.js app as a server-rendered page

Treat the keyboard as a **first-class page** of the Next.js app, not as an embedded widget. This gives us:

- Server-rendered HTML that Google can index.
- Native control over `<head>` metadata (Next.js `Metadata` API).
- The same nav, footer, and global styles as the rest of `app.legaltype.com` (so the keyboard page feels native to the site).
- Simple deploy story — it ships when the Next.js app ships.

The keyboard's runtime logic is plain DOM manipulation (no React state, no virtual DOM). That is fine — wrap it in a thin React component that mounts the existing logic into a `ref`. We are not rewriting the keyboard, we are hosting it inside a Next.js page.

### Why not an iframe?

An iframe is the fastest path but the worst for SEO: Google indexes the iframe's source document, not the parent page, and any `<title>` / OG tags on `app.legaltype.com/web-keyboard` won't reflect what the user actually sees. Skip it.

### Why not "drop the static files into `/public/web-keyboard/`"?

Tempting, but `app.legaltype.com/web-keyboard` would then bypass Next.js routing and the metadata API. You'd lose the shared nav/footer and have to maintain two parallel sets of `<head>` tags. Use this only as a fallback (see §8).

---

## 3. Target file layout in the Next.js app

Assuming the Next.js app uses the App Router (`app/` directory). If it uses the Pages Router (`pages/`), the same structure applies with `pages/web-keyboard/index.tsx` instead.

```
app/
  web-keyboard/
    page.tsx              # Server component. Owns metadata + JSON-LD. Renders <KeyboardClient />.
    KeyboardClient.tsx    # 'use client' wrapper. Mounts the vanilla keyboard into a ref.
    keyboard.css          # Copied from assets/css/styles.css, scoped to .lt-keyboard root.
    lib/
      keyboard.ts         # Port of assets/js/keyboard.js (or import as-is, see §4).
      layouts/
        legal-en.ts       # Port of assets/js/layouts/legal-en.js.
public/
  web-keyboard/
    og-image.png          # 1200x630 social preview (see §5).
```

The `app/web-keyboard/page.tsx` is a **server component** — it owns the SEO. `KeyboardClient.tsx` is the **only** client component, marked `'use client'`, and it's where the existing DOM logic runs.

---

## 4. Porting the keyboard code

Two acceptable options. Pick whichever the team finds faster — both are reversible.

**Option A — Lift-and-shift (fastest).** Copy `app.js`, `keyboard.js`, `layouts/legal-en.js` into `app/web-keyboard/lib/` unchanged. In `KeyboardClient.tsx`, dynamically import them inside `useEffect` so they only run in the browser. Style isolation: prefix every selector in `keyboard.css` with `.lt-keyboard` and wrap the rendered DOM in `<div className="lt-keyboard">`.

**Option B — Convert to ES modules.** Same code, but rewrite the IIFE/global-script pattern as `export`/`import`. Cleaner long-term, costs maybe half a day.

Either way, **do not rewrite the keyboard as React state**. The current implementation is deliberately simple — keep it that way.

The HTML inside `<main class="app">` from `index.html` becomes the JSX rendered by `KeyboardClient.tsx`. Skip the existing `<header>` and `<footer>` from `index.html` — those are already provided by the Next.js layout.

---

## 5. SEO checklist (concrete tags to add)

All of these belong in `app/web-keyboard/page.tsx` via Next's `Metadata` export, or — if the team prefers explicit control — directly in the `<head>` of the layout.

### 5.1. Core meta

```tsx
// app/web-keyboard/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Online Legal Keyboard — Type § ¶ © ® ™ in Your Browser | LegalType',
  description:
    'Free browser-based legal keyboard. Type legal symbols (§ ¶ © ® ™ Δ † ‡), currency (€ £ ¥), and accented characters with no install. Works on Chromebook, kiosk, or any locked-down computer.',
  keywords: [
    'legal keyboard',
    'section symbol',
    'paragraph symbol',
    'legal symbols',
    '§ keyboard',
    'online keyboard',
    'virtual keyboard',
    'lawyer typing tool',
  ],
  alternates: {
    canonical: 'https://app.legaltype.com/web-keyboard',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
  openGraph: {
    type: 'website',
    url: 'https://app.legaltype.com/web-keyboard',
    siteName: 'LegalType',
    title: 'Free Online Legal Keyboard — Type § ¶ © ® ™',
    description:
      'Browser-based virtual keyboard for legal symbols. No install. Works anywhere.',
    images: [
      {
        url: 'https://app.legaltype.com/web-keyboard/og-image.png',
        width: 1200,
        height: 630,
        alt: 'LegalType Web Keyboard — type legal symbols in any browser',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Online Legal Keyboard — LegalType',
    description: 'Type § ¶ © ® ™ Δ in your browser. No install.',
    images: ['https://app.legaltype.com/web-keyboard/og-image.png'],
  },
};
```

### 5.2. Structured data (JSON-LD)

Render this as a `<script type="application/ld+json">` in `page.tsx`. It tells Google this is a free web app, which often unlocks richer search results.

```tsx
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'LegalType Web Keyboard',
  url: 'https://app.legaltype.com/web-keyboard',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any (browser-based)',
  description:
    'Free browser-based virtual keyboard for typing legal symbols (§ ¶ © ® ™), currency, and accented characters.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: {
    '@type': 'Organization',
    name: 'LegalType',
    url: 'https://legaltype.com',
  },
};
```

The existing FAQ section in `index.html` is already structured for `FAQPage` JSON-LD — please add a second `<script type="application/ld+json">` with `@type: "FAQPage"` and the 11 questions/answers from the current page. This often produces FAQ-rich-result snippets in Google.

### 5.3. Sitemap & robots

- Add `/web-keyboard` to `app.legaltype.com`'s `sitemap.xml` (or the dynamic `app/sitemap.ts`).
- Confirm `robots.txt` does **not** disallow `/web-keyboard`.
- Submit the updated sitemap in Google Search Console after deploy.

### 5.4. Performance signals (Core Web Vitals)

Google ranks on these. The current page is light — keep it that way:

- Inline the critical CSS for the above-the-fold area, defer the rest.
- Self-host the Poppins font (currently loaded from Google Fonts) via `next/font/google` — this avoids an extra DNS round-trip and removes a render-blocking request.
- Lazy-mount the keyboard layout JS (the IIFE in `legal-en.js`) after first paint — it's not needed for the LCP.
- Add `loading="lazy"` to any below-the-fold images.
- Target Lighthouse mobile score ≥ 90 across Performance, Accessibility, Best Practices, SEO.

### 5.5. Accessibility (also helps SEO)

- The page already uses `role="toolbar"` and `aria-label` — keep them.
- Add `lang="en"` on the `<html>` tag (Next.js handles this in the root layout — verify it's set).
- Make sure every keyboard button has a discoverable accessible name (the symbol alone is not enough for a screen reader — add `aria-label="Section symbol"` on the § key, etc.).

---

## 6. Routing & redirects

- New canonical URL: `https://app.legaltype.com/web-keyboard`
- Old URL: `https://legaltype.ai` (current GitHub Pages site)
- Set up a **301 redirect** from `https://legaltype.ai` → `https://app.legaltype.com/web-keyboard`. This preserves any existing SEO equity. Configure it in whatever DNS / hosting fronts `legaltype.ai` (Cloudflare Page Rule, Vercel redirects, or an `_redirects` file).
- Inside the Next.js app, also redirect `/web-keyboard/` (trailing slash) → `/web-keyboard` (or vice versa — pick one canonical form and stick to it).

---

## 7. Update workflow (how future changes ship efficiently)

The goal: small, reviewable changes flow from this repo to production in under an hour, with no manual steps.

### 7.1. Repo access

1. Add the India dev team as collaborators on `getlegaltype/legaltype-web-keyboard` (read + write, **not** admin).
2. Branch protection on `main`: require pull request, require 1 approval, require CI to pass.
3. They cannot push directly to `main` — they open PRs. You (or a designated reviewer) approve and merge.

### 7.2. Two-repo model

This repo (`legaltype-web-keyboard`) remains the **source of truth** for the keyboard's logic, layouts, and styles. The Next.js app at `app.legaltype.com` consumes it.

Pick one of these consumption strategies:

**A. Git submodule** — `app.legaltype.com` includes this repo as a submodule under `app/web-keyboard/lib/`. Updates: bump submodule pointer, open PR on the app repo. Simple, no package registry needed.

**B. Private npm package** — Publish this repo as `@legaltype/web-keyboard` to GitHub Packages (private). The app does `npm install @legaltype/web-keyboard`. Updates: cut a new version here, bump version in the app. More overhead, but versioned and clean.

**C. Direct copy** — One-time copy of the files into the Next.js app, then maintain there. Loses the link to this repo; only choose this if the keyboard will diverge significantly from the standalone version. **Not recommended.**

→ **Recommended: Submodule (A) for the first 6 months.** Switch to npm package (B) only if multiple downstream apps end up consuming the keyboard.

### 7.3. Branching & releases

```
main          ← protected, always deployable
  └─ feat/*   ← feature branches (e.g. feat/spanish-layout)
  └─ fix/*    ← bug fixes
```

- Conventional Commits (`feat:`, `fix:`, `chore:`) — enables automated changelog.
- Tag releases with semantic versions (`v1.0.0`, `v1.1.0`). Even if nothing consumes the tags today, you'll want them when the team grows.
- For each release, write release notes in GitHub Releases. The dev team uses these to know what's in production.

### 7.4. CI/CD

This repo:

- Keep the existing `pages.yml` workflow so the standalone version at `legaltype.ai` (or its successor) keeps deploying automatically. (Or retire it once the migration is complete and `legaltype.ai` 301s to the app.)
- Add a `lint.yml` workflow: run Prettier + ESLint + a Lighthouse CI check on every PR.

Next.js app side:

- The dev team's existing CI/CD for `app.legaltype.com` handles this — adding `/web-keyboard` is just another route. No new pipeline.

### 7.5. Definition of "an efficient update"

A typo fix in a keycap label should look like:

1. Engineer opens PR in this repo with the change.
2. CI passes (lint + Lighthouse).
3. Reviewer approves, merges to `main`.
4. CI tags `v1.x.y` and (if using npm) publishes the package.
5. App repo's renovate/dependabot opens a PR to bump the version (or engineer bumps the submodule pointer).
6. App PR merges, Vercel/whatever deploys, change is live on `app.legaltype.com/web-keyboard`.

Total: ~30 minutes of human time across the full path.

---

## 8. Fallback approach (if porting to Next.js is blocked)

If the dev team cannot port to a Next.js page in the available timeline, drop the static files into `app.legaltype.com`'s `public/web-keyboard/` directory. The trade-off:

- ✅ Works in a day.
- ❌ No shared nav/footer.
- ❌ SEO `<head>` tags must be hand-managed in `public/web-keyboard/index.html`.
- ❌ The page won't have access to the Next.js Metadata API — manually add every `<meta>` tag from §5 to the static HTML.

If you go this route, still configure the 301 from `legaltype.ai` (§6) and still add `/web-keyboard` to the sitemap.

---

## 9. Acceptance criteria

The migration is "done" when **all** of these are true:

- [ ] `https://app.legaltype.com/web-keyboard` loads the keyboard and all interactions work (mouse click, physical keyboard, AltGr toggle, Copy/Cut/Paste/Clear/Select All buttons, layout dropdown).
- [ ] `view-source:https://app.legaltype.com/web-keyboard` shows the metadata from §5.1 — title, description, canonical, OG, Twitter — all present and correct.
- [ ] Both JSON-LD blobs (`WebApplication` + `FAQPage`) appear in the rendered HTML and validate at https://validator.schema.org.
- [ ] `https://app.legaltype.com/sitemap.xml` includes `/web-keyboard`.
- [ ] `https://app.legaltype.com/robots.txt` does not disallow `/web-keyboard`.
- [ ] `https://legaltype.ai` 301s to `https://app.legaltype.com/web-keyboard`.
- [ ] Lighthouse mobile audit ≥ 90 on Performance, Accessibility, Best Practices, SEO.
- [ ] FAQ section is preserved (all 11 questions, same wording).
- [ ] Page works with JavaScript disabled to the extent that the FAQ and metadata are still readable (the keyboard itself requires JS — that's fine).
- [ ] Verified on: Chrome (desktop + Android), Safari (macOS + iOS), Firefox, Edge.
- [ ] No new external dependencies beyond Next.js itself — keyboard logic remains pure DOM JS.
- [ ] No tracking pixels, no third-party scripts. (The site says "no tracking, no ads" — keep that promise.)

---

## 10. Phased timeline (suggested)

**Phase 1 — Setup (½ day).** Add India team to repo. Confirm Next.js app uses App Router or Pages Router. Decide submodule vs. npm package (§7.2).

**Phase 2 — Port (1–2 days).** Create `app/web-keyboard/page.tsx` + `KeyboardClient.tsx`. Move CSS, scope it. Verify keyboard works on a preview deploy.

**Phase 3 — SEO (½ day).** Add metadata, JSON-LD, sitemap entry, OG image. Validate.

**Phase 4 — Redirect & launch (½ day).** Set up `legaltype.ai` → `app.legaltype.com/web-keyboard` 301. Submit updated sitemap to Google Search Console. Announce.

**Phase 5 — Polish (ongoing).** Watch Search Console for impressions/clicks. Iterate on title/description if CTR is poor. Add additional layouts (Spanish legal, French legal) as separate PRs.

Total: ~3 working days for a focused engineer.

---

## 11. Open questions for the dev team

Please confirm before starting:

1. App Router or Pages Router on `app.legaltype.com`?
2. What's the current sitemap setup — static file, dynamic route, or none?
3. Is the global nav/footer configurable per-page, or always rendered? (We may want a slimmer chrome on `/web-keyboard` to maximize keyboard real estate.)
4. Where does `legaltype.ai`'s DNS resolve today, and who has access to set up the 301?
5. Do you want analytics on this page? Default is **no** — the standalone site has none. If yes, what tool?

---

*Document version: 1.0 — drafted 2026-05-07.*
