# Chrome Web Store listing — paste-ready copy

This file contains every text field you need to fill in the Chrome Web Store
Developer Dashboard, in the order the form asks for them. Treat each block
as paste-into-form text — the store's textareas are plain text, no markdown.

---

## Item name

Hackdrop

## Summary (short description) — 132 char limit

GitHub Trending and Hacker News in every new tab. Side by side, theme-aware, zero configuration.

(96 characters)

## Description (full)

Hackdrop replaces your new-tab page with two clean columns of what's new in software: GitHub Trending on the left, Hacker News on the right. Open a tab and you get the same signal you'd get from manually checking github.com/trending and news.ycombinator.com — without the click.

WHAT YOU GET

• Two clean columns. GitHub Trending on the left, Hacker News on the right.
• Daily, weekly, or monthly trending. Your last choice is remembered.
• Auto theme. Follows your browser's prefers-color-scheme. No toggle, no flash on load.
• Fast. Cached results render instantly, then refresh in the background.
• Quiet. No accounts, no settings page, no notifications.
• Open source, MIT-licensed.

PRIVACY

Hackdrop has no analytics, no accounts, and no third-party trackers. The extension talks to a single host — hackdrop-api.theedoran.xyz — operated by the developer, which proxies github.com/trending and the official Hacker News API on the server side. Your browser never contacts those services directly.

The only thing stored on your device is a short-lived cache of the public trending lists, kept in browser.storage.local. The full privacy policy is linked from the listing.

LINKS

Source code, issues, and changelog: https://github.com/theedoran/hackdrop
Live preview (no install required): https://hackdrop.theedoran.xyz

---

## Category

Productivity

## Language

English (United States) — primary. Add others only if you ship localized strings.

---

## Privacy practices tab

### Single purpose description

Replaces the new-tab page with a feed of GitHub Trending repositories and Hacker News top stories.

### Permission justifications

Paste each into the matching field. The dashboard asks one question per declared permission. Hackdrop declares no host permissions — the new-tab page reaches the API via a standard cross-origin `fetch()` allowed by the backend's open CORS policy and the extension's `content_security_policy.connect-src` directive, so no host justification is required.

**`storage` permission:**
Caches the trending lists locally so a new tab opens instantly without re-fetching, and persists the user's daily/weekly/monthly filter choice between sessions. The cache holds only the public trending data the API returns.

**`chrome_url_overrides.newtab` (if asked separately):**
Renders Hackdrop as the new-tab page. This is the extension's single purpose.

### Data usage disclosures

Tick:
- **I do not collect or use user data** — true. Hackdrop has no analytics, no accounts, no telemetry.
- Certify the developer program policies.

### Privacy policy URL

You need a stable HTTPS URL. Options, in order of preference:

1. **Best — host on your own domain.** Publish `docs/PRIVACY.md` as a static page at e.g. `https://hackdrop.theedoran.xyz/privacy`. Reviewers like dedicated pages.
2. **Acceptable — GitHub-rendered file.** `https://github.com/theedoran/hackdrop/blob/main/docs/PRIVACY.md`
3. **Last resort — GitHub raw.** `https://raw.githubusercontent.com/theedoran/hackdrop/main/docs/PRIVACY.md`

Pick one and paste it into the Privacy policy URL field. Whichever URL you submit must keep working — if you change paths later, update the listing too.

---

## Distribution tab

- **Visibility:** Public.
- **Distribution:** Default to all regions unless you have a reason to restrict.

---

## Assets reference

| Asset | File | Required? |
|---|---|---|
| Item icon (128×128 PNG) | `extension/public/icons/icon-128.png` | yes |
| Screenshot 1 (1280×800 PNG) | `store-assets/chrome-web-store/screenshots/01-light-theme-1280x800.png` | at least one required |
| Screenshot 2 (1280×800 PNG) | `store-assets/chrome-web-store/screenshots/02-dark-theme-1280x800.png` | recommended |
| Small promo tile (440×280 PNG) | `store-assets/chrome-web-store/promo/small-promo-tile-440x280.png` | optional, recommended |
| Marquee promo tile (1400×560 PNG) | `store-assets/chrome-web-store/promo/marquee-promo-tile-1400x560.png` | optional, only for featuring consideration |
