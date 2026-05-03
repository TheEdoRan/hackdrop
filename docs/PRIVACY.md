# Hackdrop Privacy Policy

_Last updated: 2026-05-03_

Hackdrop is a browser extension that replaces the new-tab page with a feed of GitHub Trending repositories and Hacker News stories. This page describes everything Hackdrop does that touches your data.

## Summary

- Hackdrop does **not** collect, store, or transmit any personal data.
- Hackdrop does **not** track users, run analytics, or use cookies.
- Hackdrop does **not** sell, share, or monetize anything.
- The only data stored on your device is a short-lived cache of the public trending lists, kept in the browser's extension storage.

## What Hackdrop sends over the network

When you open a new tab, Hackdrop makes two kinds of HTTP requests:

1. **GitHub Trending data** — a request to `https://hackdrop-api.theedoran.xyz/v1/github`. This is a small backend service operated by the developer that scrapes the public `github.com/trending` page every hour and returns the parsed list. The request includes only the standard headers your browser attaches automatically (User-Agent, etc.). No identifiers are added by the extension.
2. **Hacker News stories** — a request to `https://hackdrop-api.theedoran.xyz/v1/hackernews`. The same backend service fetches the top stories from Y Combinator's official Hacker News API on the server side and returns the parsed list, so your browser never contacts the Hacker News API directly. The request includes only the standard headers your browser attaches automatically. No identifiers are added by the extension.

Both endpoints are public and read-only. Hackdrop never sends form data, login credentials, page contents, browsing history, or any other personal information.

## What Hackdrop stores on your device

Hackdrop uses the browser's `storage.local` API (via the `storage` permission declared in the manifest) to cache the trending lists it has already fetched. This avoids re-downloading the same lists every time you open a new tab.

The cache contains only:

- The list of trending GitHub repositories (name, description, language, stars).
- The list of top Hacker News stories (title, URL, author, score).
- A timestamp indicating when each list was fetched.

This data is identical to what is publicly visible on `github.com/trending` and `news.ycombinator.com`. It never leaves your device, and it is automatically replaced when newer data is fetched. You can clear it at any time by removing the extension or clearing your browser's extension storage.

## Permissions justification

| Permission | Why it's needed |
|---|---|
| `storage` | Cache the trending lists locally so new tabs open instantly without re-fetching every time. |
| `host_permissions` for `https://hackdrop-api.theedoran.xyz/*` | Fetch the cached GitHub Trending list and Hacker News top stories from the developer's caching backend. |
| `chrome_url_overrides.newtab` | Render Hackdrop as the new-tab page. |

Hackdrop does not request `tabs`, `activeTab`, `webRequest`, `cookies`, `history`, `bookmarks`, `<all_urls>`, content scripts on arbitrary pages, or any other permission beyond the ones above.

## Third parties

The extension communicates with one third-party endpoint:

- **`hackdrop-api.theedoran.xyz`** — operated by the developer (Edoardo Ranghieri). The backend is a stateless caching proxy that combines GitHub Trending (scraped from the public `github.com/trending` page) and Hacker News top stories (fetched from Y Combinator's official Hacker News API on the server side, not from your browser). It stores no logs that include user-identifying data. Standard ephemeral access logs may exist at the hosting layer (IP and User-Agent for incoming HTTP requests, retained briefly for operational purposes) and are not linked to any user identity.

No advertising, analytics, or tracking SDKs are bundled with the extension.

## Children's privacy

Hackdrop does not knowingly collect any data from any user, including children under 13.

## Changes to this policy

If this policy changes, the new version will be published at the same URL with an updated date at the top.

## Contact

Questions or concerns: **me@theedoran.xyz**.
