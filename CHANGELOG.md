# Changelog

All notable changes to Hackdrop are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Categories used: **Added** (new features), **Changed** (changes to existing behavior), **Fixed** (bug fixes), **Removed** (dropped features), **Security** (vulnerability fixes). Empty categories may be omitted.

## [Unreleased]

### Added

- The GitHub Trending column now has a daily / weekly / monthly filter in its header. Your last choice is remembered and used the next time you open a new tab.

### Changed

- Hacker News scores now show a small orange triangle to make the number self-explanatory at a glance.
- Bumped the contrast on item metadata (stars, comments, language, timestamps) so it's still muted but actually legible in both light and dark mode.
- Buttons now show the pointer cursor on hover.
- Hacker News data now flows through the Hackdrop server instead of being fetched directly from the Hacker News API by every browser. Pages load faster, results are edge-cached, and the column survives transient API hiccups by holding the previously-loaded stories.

### Fixed

- The Hacker News column header now shows the proper "Y" inside the orange square instead of a solid orange box.
- The Hacker News column could go silently blank — no error, no items — when the upstream API was briefly flaky. It now shows the last known stories or a clear "Couldn't load" message instead.

### Removed

- The extension no longer needs the `hacker-news.firebaseio.com` host permission, since Hacker News data is fetched through the Hackdrop server.

## [0.1.0] - 2026-05-02

### Added

- Initial release: GitHub Trending and Hacker News, side by side in every new tab.
- Auto theme follows your browser's light/dark preference.
- Available for Chromium-based browsers and Firefox.
