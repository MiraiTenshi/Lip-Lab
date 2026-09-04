# Lip Shade Lab

Try lip color shades on your own photo, blended with real color science —
not a flat overlay. Runs entirely in the browser: no server, no database,
your photo never leaves your device.

**[Live demo →](#)** _(update this link once deployed — see below)_

## How it works

1. **Product library.** You drop photos of lip products applied on lips into
   `/products`. The filename becomes the product name. A build script scans
   each photo, samples its color in LAB space, and writes a small JSON
   catalog (`public/products/manifest.json`) — no database needed.
2. **Face + lip detection.** When you upload your own photo, Google's
   MediaPipe Face Landmarker (running fully in-browser via WebAssembly)
   finds ~40 lip-contour points and builds a soft-edged mask of your lips,
   excluding your teeth/mouth interior.
3. **Color-science blending.** Instead of pasting the product's color over
   your lips, the app:
   - Converts both your natural lip color and the product's color into
     **CIE LAB space** (perceptually uniform — separates lightness from
     hue/chroma, unlike RGB).
   - **Keeps your natural lightness/shading** (highlights, shadows, the
     texture and curve of your lips) and swaps in the product's hue and
     chroma — so it looks like product on your lips, not a sticker.
   - **Preserves specular highlights** (glossy highlight spots stay bright
     rather than being fully tinted).
   - **Detects your undertone** (warm / cool / neutral) from your natural
     lip color and gently harmonizes the product's hue toward it (~6°
     hue rotation), the way a makeup artist would color-correct rather than
     fight your undertone.
   - Reduces saturation slightly in shadow/crease areas so pigment doesn't
     look flat across the lip's 3D shape.
4. Switch between shades instantly, adjust intensity with a slider, and
   nothing is ever uploaded anywhere — the moment you refresh, your photo
   is gone.

## Getting started

```bash
npm install
npm run manifest   # scans /products, builds public/products/manifest.json
npm run dev        # starts local dev server
```

Open the printed local URL, add a couple of product photos to `/products`
first (see `/products/README.md`) if you want the shade rail populated.

## Adding products

Drop images into `/products` — see `/products/README.md` for naming and
photo guidelines. Then either:

- run `npm run manifest` locally and commit the result, or
- just commit the photos and push — the GitHub Action rebuilds the
  manifest automatically on every push to `main`.

## Deploying to GitHub Pages

This repo includes a GitHub Actions workflow
(`.github/workflows/deploy.yml`) that builds the site and deploys it to
GitHub Pages automatically on every push to `main`.

One-time setup after you push this repo to GitHub:

1. Go to **Settings → Pages** in your repository.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or re-run the workflow from the **Actions** tab).
4. Your site will be live at `https://<your-username>.github.io/<repo-name>/`.

The build automatically picks up your repo name for the correct base path
— no manual config needed, as long as you deploy via the included workflow.

### Deploying manually / elsewhere

```bash
npm run build     # outputs to /dist
```

If hosting somewhere other than GitHub Pages at a root domain, set
`REPO_NAME=""` as an env var before building (or edit the fallback in
`vite.config.js`) so asset paths resolve correctly.

## Tech stack

- **React + Vite** — UI and build tooling
- **MediaPipe Tasks Vision (Face Landmarker)** — in-browser face/lip
  landmark detection, loaded from Google's CDN, runs on-device via WASM/GPU
- **Canvas 2D API** — image manipulation and LAB color blending
- **sharp** (build-time only, in Node) — decoding product photos and
  extracting representative colors when generating the manifest
- No backend, no database, no analytics, no image uploads

## Project structure

```
products/                    # ← you add source photos here
public/products/             # generated: resized copies + manifest.json
scripts/build-manifest.js    # scans products/, extracts colors, writes manifest
src/
  lib/
    colorScience.js          # RGB<->LAB, undertone detection, lip recoloring
    lipDetection.js           # MediaPipe wrapper, lip mask generation
  components/                # UI
  App.jsx
.github/workflows/deploy.yml # CI: build + deploy to GitHub Pages
```

## Limitations

- Works best with clear, front-facing, well-lit photos where the mouth is
  closed or only slightly open.
- Face detection requires MediaPipe's model to load from Google's CDN on
  first use (cached afterward) — needs an internet connection the first
  time, even though no photo data is ever sent anywhere.
- Color extraction from product photos is automatic and works well for
  photos where the product color is clearly visible on the lips; heavily
  filtered or stylized photos may extract a less accurate color. You can
  always swap in a different, more representative photo and re-run
  `npm run manifest`.
