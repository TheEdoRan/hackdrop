# Chrome Web Store assets

Everything you need to upload alongside the packaged `.zip` for a Chrome Web
Store submission. See [`extension/DEPLOYMENT.md`](../../extension/DEPLOYMENT.md)
for the full submission flow.

## Layout

```
chrome-web-store/
├── LISTING.md                                     paste-ready copy for every form field
├── screenshots/
│   ├── 01-light-theme-1280x800.png
│   └── 02-dark-theme-1280x800.png
├── promo/
│   ├── small-promo-tile-440x280.png
│   └── marquee-promo-tile-1400x560.png
└── _src/                                          source HTML and staged images for re-rendering
    ├── promo-440.html
    ├── promo-1400.html
    ├── logo.png
    └── screenshot-dark.png
```

## Re-rendering the promo tiles

The promo tiles are rendered from local HTML files via headless Chrome. To regenerate after editing:

```bash
cd store-assets/chrome-web-store/_src

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
	--headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
	--window-size=440,280 \
	--screenshot=../promo/small-promo-tile-440x280.png \
	"file://$PWD/promo-440.html"

"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
	--headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
	--window-size=1400,560 \
	--screenshot=../promo/marquee-promo-tile-1400x560.png \
	"file://$PWD/promo-1400.html"
```

## Re-rendering the screenshots

The screenshots are downscaled from `assets/hackdrop-light.png` and
`assets/hackdrop-dark.png` (3200×2000, exact 16:10) using macOS `sips`:

```bash
sips -z 800 1280 assets/hackdrop-light.png --out store-assets/chrome-web-store/screenshots/01-light-theme-1280x800.png
sips -z 800 1280 assets/hackdrop-dark.png  --out store-assets/chrome-web-store/screenshots/02-dark-theme-1280x800.png
```

If you replace the source captures (e.g. after a UI change), retake them at
or above 1280×800 in 16:10 aspect so the downscale stays clean.
