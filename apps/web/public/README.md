# Drop your favicon files here

Place these files directly in `apps/web/public/`:

| Filename | Size | Purpose |
|---|---|---|
| `favicon.ico` | 32×32 (multi-res ico) | Browser tab fallback (all browsers) |
| `favicon-16x16.png` | 16×16 | Small browser tab |
| `favicon-32x32.png` | 32×32 | Retina browser tab |
| `apple-touch-icon.png` | 180×180 | iOS home screen icon |
| `android-chrome-192x192.png` | 192×192 | Android home screen / PWA |
| `android-chrome-512x512.png` | 512×512 | PWA splash + maskable icon |

> Tip: generate the full set from one master 1024×1024 PNG using https://realfavicongenerator.net — it produces exactly these filenames.

After adding the files, just `git add apps/web/public/*.png apps/web/public/*.ico && git commit && git push`. They are referenced from:

- `src/app/layout.tsx` → `metadata.icons` (favicons + apple-touch)
- `public/manifest.webmanifest` → PWA install icons
- `public/sw.js` → precached for offline
