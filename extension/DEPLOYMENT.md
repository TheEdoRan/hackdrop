# Extension deployment

This document covers building, side-loading, and publishing the Hackdrop browser extension to the **Chrome Web Store** (Chromium browsers) and **Mozilla Add-ons** (Firefox).

For deploying the Hono API the extension talks to, see [`server/DEPLOYMENT.md`](../server/DEPLOYMENT.md).

## Prerequisites

- Node 24+ and pnpm 10.x (see repo `.nvmrc`).
- A working clone of the repo with deps installed: `pnpm install` from the repo root.
- The API URL the extension calls is hardcoded in two places:
  - `extension/src/sources/github-trending/fetch.ts`
  - `extension/public/manifest.json` (`content_security_policy.connect-src`)
  - To target a different backend, change both and rebuild.

## 1. Build artifacts

### 1.1. Unpacked build (`dist/`)

```bash
pnpm --filter @hackdrop/extension build
```

This runs `tsc --noEmit && vite build` and produces `extension/dist/` containing `manifest.json`, the bundled JS/CSS, fonts, and icons. This is what the browser actually loads — both side-loaded and in store builds.

### 1.2. Packaged zip (`web-ext-artifacts/`)

```bash
pnpm --filter @hackdrop/extension package
```

This builds, then runs `web-ext build --source-dir=dist`, producing `extension/web-ext-artifacts/hackdrop-<version>.zip`. The zip is what you upload to either store.

### 1.3. Lint the packaged build

Before submitting to either store, sanity-check with Mozilla's `web-ext` linter — it catches manifest issues, missing icons, and CSP violations that AMO will reject:

```bash
pnpm --filter @hackdrop/extension lint:webext
```

Address every error and review warnings. Chrome's review tooling is less strict than AMO's, but issues `web-ext` flags usually trip both reviewers.

### 1.4. Versioning

Don't bump the version in `extension/package.json` or `extension/public/manifest.json` by hand — use the release script from the repo root:

```bash
pnpm release patch    # or minor / major / x.y.z
git push --follow-tags
```

This keeps `extension/package.json`, `extension/public/manifest.json`, and root `package.json` in lockstep, promotes `CHANGELOG.md`'s `[Unreleased]` section, commits, and tags. Pushing the `v*` tag triggers `.github/workflows/release.yml`, which runs `pnpm --filter @hackdrop/extension package` in CI and attaches the resulting zip to the GitHub Release. **That zip is the canonical artifact to upload to the stores** — it's reproducible from the tagged commit.

## 2. Side-load for testing

Both stores require you to verify the build works before submitting. Side-load it locally first.

### 2.1. Chromium (Chrome / Edge / Brave / Arc / Vivaldi / etc.)

1. Open `chrome://extensions` (or the equivalent for your browser).
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select `extension/dist/`.
4. Open a new tab — Hackdrop should be your new-tab page.

To reload after rebuilding: hit the reload icon on the extension card.

### 2.2. Firefox — temporary install

Side-loaded MV3 extensions in Firefox are wiped on browser restart, which is fine for testing:

1. Go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `extension/dist/manifest.json`.
4. Open a new tab.

For a persistent install on a single machine without going through AMO, use Firefox Developer Edition or Nightly with `xpinstall.signatures.required` set to `false` in `about:config`, then drag the packaged `.zip` (renamed to `.xpi`) onto the browser.

## 3. Publish to the Chrome Web Store

The Chrome Web Store also serves Edge (via the Microsoft Edge Add-ons store, separate process), Brave, Opera, and most other Chromium browsers re-distribute Chrome Web Store extensions transparently. You only need to submit to one place.

### 3.1. One-time setup

1. Create a [Chrome Web Store developer account](https://chrome.google.com/webstore/devconsole/) — there is a **one-time $5 USD registration fee**.
2. Decide whether to publish under your personal account or a Google Workspace group. Group accounts are more flexible if multiple people maintain the extension.
3. Have ready, before you start the submission flow:
   - The packaged `.zip` from the GitHub Release (or `pnpm --filter @hackdrop/extension package`).
   - **Store listing assets**:
     - **Icon**: 128×128 PNG (already in `extension/public/icons/icon-128.png`).
     - **Screenshots**: at least one, 1280×800 or 640×400 PNG/JPEG. Capture the new-tab page in a real browser at the right resolution. Plan for 2–5 to make the listing look complete.
     - **Small promo tile** (optional but recommended): 440×280 PNG/JPEG.
     - **Marquee promo tile** (optional, only if you want to be considered for featuring): 1400×560 PNG/JPEG.
   - **Listing copy**:
     - Short description (≤ 132 characters).
     - Full description (Markdown not supported — plain text with line breaks).
     - Category — `Productivity` is the natural fit.
     - Language(s).
   - **Privacy policy URL**: recommended in all cases and required by some store fields. Hackdrop's policy lives at `docs/PRIVACY.md`; publish it on a stable HTTPS URL (GitHub raw URLs work but a real page is preferable).
   - **Justifications** for every declared permission. Hackdrop only declares `storage` (and `chrome_url_overrides.newtab` if asked separately) — no host permissions. The justifications are spelled out in `docs/PRIVACY.md` under "Permissions justification" — paste those into the Chrome Web Store form verbatim. The store rejects vague answers like "needed for the extension to work."

### 3.2. Submission flow

1. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/), click **New item** and upload the `.zip`.
2. Fill in the **Store listing** tab: description, screenshots, category, language.
3. Fill in the **Privacy practices** tab:
   - Single purpose: "Replaces the new-tab page with a feed of GitHub Trending and Hacker News."
   - Permission justifications (one per item — only `storage` is declared; no host permissions).
   - Tick "I do not collect or use user data" (true for Hackdrop) and accept the developer program policies.
   - Provide the privacy policy URL.
4. Choose **Distribution**:
   - Public (anyone can install) vs. unlisted (only people with the direct link).
   - Visible in which countries — default to all unless you have a reason to restrict.
5. Submit for review. Reviews typically take a few hours to a few days. You'll get an email if it's rejected with the reason; fix and resubmit.

### 3.3. Updating an existing listing

1. Bump the version with `pnpm release` and push the tag (CI builds the zip and attaches it to the GitHub Release).
2. In the Developer Dashboard, open the item, go to **Package**, upload the new `.zip`, and click **Submit for review**.
3. Listing copy / screenshots only need touching when they actually change — uploading a new package alone is enough for a code-only update.

## 4. Publish to Mozilla Add-ons (AMO)

Firefox is the only mainstream browser that **requires** signing for distribution outside the store. Even self-hosted Firefox extensions must be signed by Mozilla.

### 4.1. One-time setup

1. Create an account on [addons.mozilla.org](https://addons.mozilla.org/developers/).
2. Decide between two distribution channels:
   - **Listed** — published on AMO, discoverable, auto-updates from there. This is the default for a public extension.
   - **Unlisted** (self-distribution) — Mozilla signs the build but doesn't host it. You distribute the signed `.xpi` yourself (e.g. on a website or GitHub Releases). Updates require an `update_url` in the manifest. Useful for closed-beta or enterprise distribution.
3. The `gecko` block in `extension/public/manifest.json` already declares the add-on ID (`hackdrop@theedoran.xyz`), `strict_min_version`, and `data_collection_permissions` — AMO uses these, so don't change them between submissions or you'll create a new add-on instead of updating the existing one.

### 4.2. Listed submission

1. From the [Developer Hub](https://addons.mozilla.org/developers/), click **Submit a New Add-on**.
2. Select **On this site** (listed).
3. Upload the `.zip` from `extension/web-ext-artifacts/`. AMO validates the manifest and runs an automated linter — same checks as `pnpm --filter @hackdrop/extension lint:webext`, so fix any issues there first.
4. Indicate whether your code is a direct upload of the source tree or whether it was transformed (minified, bundled). Hackdrop is bundled by Vite, so the answer is **yes** — and Mozilla will require a **source code submission** along with the build:
   - Provide either a `.zip` of the repo at the tagged commit or a public repo URL + tag/commit hash + build instructions.
   - Build instructions for Hackdrop: `pnpm install && pnpm --filter @hackdrop/extension package` from the repo root using the Node version pinned in `.nvmrc`.
5. Fill in **listing details**:
   - Name, summary, description, category (`Search Tools` or `Other` — Productivity isn't a separate category on AMO).
   - Tags, license (this repo's `LICENSE` is the source of truth — keep it consistent on AMO).
   - Privacy policy URL — same one as Chrome.
   - Screenshots and icon: AMO accepts PNG up to 4 MB, recommended 2400×1800 (will be scaled). Reuse Chrome's screenshots.
6. Submit. AMO has a mix of automated and human review; full reviews can take 1–10 days. You'll get email updates.

### 4.3. Unlisted (self-distribution) submission

1. Same flow as listed, but pick **On your own** in step 2.
2. AMO signs the `.zip`, returns a signed `.xpi`, and you host it yourself.
3. For auto-updates, add `browser_specific_settings.gecko.update_url` to `manifest.json` pointing at a JSON manifest you host (see [Firefox extension update docs](https://extensionworkshop.com/documentation/manage/updating-your-extension/)). This isn't currently configured for Hackdrop — only do this if you're explicitly going self-distribution.

### 4.4. Updating

1. Bump the version with `pnpm release` and push the tag.
2. In the Developer Hub, open the add-on, click **Upload New Version**, upload the new `.zip`, re-submit source code if the build process changed.
3. Reviewers re-check on every version, so unrelated breakage in dependencies can stall an update — keep the build reproducible.

## 5. Privacy policy and permissions

Hackdrop declares only the `storage` permission and no host permissions, so a privacy policy URL is not strictly mandated by either store on permissions grounds — but both stores still expect one and surface it in the listing, and reviewers like seeing it. Publish `docs/PRIVACY.md` either:

- At a stable URL on a domain you control, or
- Linked directly to the rendered file on GitHub.

The same file also contains permission justifications — paste them into the Chrome / AMO submission forms verbatim so the listing matches the policy.

## 6. Common rejection reasons

- **Vague permission justifications.** Reviewers want one specific sentence per permission ("`storage` is used to cache the trending list locally so the new tab opens instantly"), not "needed for core functionality."
- **Missing privacy policy URL.** Not currently required for Hackdrop's permission set, but expected by reviewers when any data — even a public cache — is stored locally; just provide it.
- **Listing screenshots that don't reflect the actual extension UI** (e.g. mocked-up images). Use real captures.
- **Source code mismatch on AMO.** The submitted source must build the exact `.zip` you uploaded with the documented commands. CI-built artifacts attached to GitHub Releases are easiest because the commit is pinned and reproducible.
- **CSP issues.** Hackdrop's `content_security_policy` in `manifest.json` is intentionally tight (`script-src 'self'`, no `unsafe-eval`, etc.). Don't loosen it for convenience — both stores flag broad CSPs.
