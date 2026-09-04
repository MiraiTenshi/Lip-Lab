# Product photos go here

Drop photos of lip products **applied on lips** into this folder. Each
filename becomes the product's display name, so name your files the way
you'd want the product shown:

```
products/
  cherry-red-matte.jpg      -> "Cherry Red Matte"
  Rosewood_Velvet.png        -> "Rosewood Velvet"
  nude-glow.jpg              -> "Nude Glow"
```

Rules of thumb for good results:

- The photo should clearly show the product applied to lips (not just the
  tube/packaging) — the app samples color from the center of the image.
- Reasonably well-lit, minimal color-cast filters, product color plainly
  visible.
- `.jpg`, `.jpeg`, `.png`, or `.webp`.
- Use hyphens or underscores between words in filenames — they'll be
  converted to spaces and title-cased automatically.

After adding or changing photos, run:

```
npm run manifest
```

to regenerate the shade library, or just run `npm run build` /
push to `main` — the included GitHub Action rebuilds the manifest
automatically before deploying.
