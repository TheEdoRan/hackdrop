# Changelog

All notable changes to Hackdrop are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Categories used: **Added** (new features), **Changed** (changes to existing behavior), **Fixed** (bug fixes), **Removed** (dropped features), **Security** (vulnerability fixes). Empty categories may be omitted.

## [Unreleased]

### Added

### Changed

### Fixed

- Fixed a brief skeleton flash on every new tab when cached items were already available. Cached data now populates cleanly without flicker, and the loading skeleton only appears when there is no cached data and a fresh request is in flight.

## [0.1.2] - 2026-05-04

### Changed

- Raised the minimum Firefox version to 140. Earlier versions (including ESR 115 and 128) can no longer install Hackdrop. The bump is required so the manifest can declare the no-data-collection permission that Mozilla now expects.

## [0.1.1] - 2026-05-03

### Added

### Changed

- Hackdrop no longer requests host access to the API. Installing or updating the extension no longer shows a "can read your data on hackdrop-api.theedoran.xyz" warning. The extension still fetches from the same host using the browser's standard cross-origin policy, so the experience is unchanged.

### Fixed

## [0.1.0] - 2026-05-03

### Added

- A new-tab page for Chromium-based browsers and Firefox that shows GitHub Trending and Hacker News side by side.
- GitHub Trending column with a daily / weekly / monthly filter — your last choice is remembered and reused on the next new tab. Each row shows the repo and owner, the language with its color dot, total stars, total forks, and the period's star delta.
- Hacker News column with the top stories: title, domain, score (next to a small orange triangle so the number is self-explanatory at a glance), author, relative time, and comment count. Clicking the row opens the Hacker News discussion; clicking the domain opens the article.
- Light and dark theme that follows your browser's preference, with item metadata (stars, comments, language, timestamps) kept muted but high-contrast in both modes.
- Responsive layout: side-by-side columns on wider screens, single-column with a tab toggle on mobile.
- Stale-while-revalidate caching: previously loaded items render instantly while fresh data is fetched in the background, and stay on screen if the upstream API hiccups. A "Couldn't load. Try again later." panel appears only when the cache is empty and the request fails too.
- All requests go through the Hackdrop API. The extension's only required permissions are `storage` and access to that single host.
