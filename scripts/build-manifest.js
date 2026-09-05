#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Scans /products for image files, derives a product name from each
// filename, samples a representative color from the image using the same
// LAB-space logic as the in-browser color science module, and writes
// /public/products/manifest.json + copies (resized) images into
// /public/products/ for the app to consume at runtime.
//
// Usage: node scripts/build-manifest.js
// Runs automatically as part of `npm run build`.
// ---------------------------------------------------------------------------

import { readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, extname, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// fileURLToPath + dirname works on any Node >=14 ESM build, unlike
// import.meta.dirname which needs Node 20.11+ — safer for CI runners that
// may be pinned to an older point release of a "Node 20" image.
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCE_DIR = join(ROOT, 'products')
const OUT_DIR = join(ROOT, 'public', 'products')
const MANIFEST_PATH = join(OUT_DIR, 'manifest.json')

const VALID_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])

function titleCaseFromFilename(filename) {
  const stem = basename(filename, extname(filename))
  return stem
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

// --- LAB conversion (mirrors src/lib/colorScience.js so the manifest's
// stored color matches what the app would compute if it re-sampled) --------

function srgbToLinear(c) {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function rgbToLab([r, g, b]) {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const x = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb
  const z = 0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb
  const REF_X = 0.95047
  const REF_Y = 1.0
  const REF_Z = 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : t / 0.128418 + 0.137931)
  const fx = f(x / REF_X)
  const fy = f(y / REF_Y)
  const fz = f(z / REF_Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function labToHex(lab) {
  const fy = (lab[0] + 16) / 116
  const fx = fy + lab[1] / 500
  const fz = fy - lab[2] / 200
  const finv = (t) => (t > 6 / 29 ? t * t * t : 3 * (6 / 29) ** 2 * (t - 4 / 29))
  const REF_X = 0.95047
  const REF_Y = 1.0
  const REF_Z = 1.08883
  const x = finv(fx) * REF_X
  const y = finv(fy) * REF_Y
  const z = finv(fz) * REF_Z
  const lin2s = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)
  let r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
  let g = -0.969266 * x + 1.876011 * y + 0.041556 * z
  let b = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z
  ;[r, g, b] = [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(lin2s(c) * 255))))
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
}

/**
 * Sample almost the whole frame (small margin only — a fixed central "lips
 * are here" box breaks badly on close-up product photos where lips fill
 * nearly the entire frame). Reject near-gray/background pixels by
 * saturation, then take the darkest 20th percentile of what's left rather
 * than the median of everything: glossy highlights and the soft skin-to-
 * lip transition are pale but still "saturated enough," and on many photos
 * those pale pixels outnumber the fuller, truer-color pixels where the
 * product sits thickest — a plain median gets pulled toward that pale
 * cluster, which is why browns and reds were both drifting toward a shared
 * pale pink/orange. The darkest, most pigment-dense pixels are the most
 * representative of the product's true color.
 */
function extractDominantLab({ data, info }) {
  const { width, height, channels } = info
  const margin = 0.08
  const xStart = Math.floor(width * margin)
  const xEnd = Math.floor(width * (1 - margin))
  const yStart = Math.floor(height * margin)
  const yEnd = Math.floor(height * (1 - margin))

  const samples = []
  for (let y = yStart; y < yEnd; y += 2) {
    for (let x = xStart; x < xEnd; x += 2) {
      const i = (y * width + x) * channels
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const lightness = (max + min) / 2
      const sat = max === min ? 0 : (max - min) / (255 - Math.abs(2 * lightness - 255))
      if (sat < 0.15) continue
      samples.push({ lightness, rgb: [r, g, b] })
    }
  }

  if (samples.length === 0) {
    const fallback = []
    for (let y = yStart; y < yEnd; y += 3) {
      for (let x = xStart; x < xEnd; x += 3) {
        const i = (y * width + x) * channels
        fallback.push(rgbToLab([data[i], data[i + 1], data[i + 2]]))
      }
    }
    fallback.sort((a, b) => a[0] - b[0])
    return fallback[Math.floor(fallback.length / 2)] || [50, 20, 10]
  }

  samples.sort((a, b) => a.lightness - b.lightness)
  const darkestSlice = samples.slice(0, Math.max(1, Math.floor(samples.length * 0.2)))
  const labs = darkestSlice.map((s) => rgbToLab(s.rgb))
  labs.sort((a, b) => a[0] - b[0])
  return labs[Math.floor(labs.length / 2)] || [50, 20, 10]
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    mkdirSync(SOURCE_DIR, { recursive: true })
    console.log('Created empty /products directory. Add product photos there and re-run.')
  }
  mkdirSync(OUT_DIR, { recursive: true })

  const files = existsSync(SOURCE_DIR)
    ? readdirSync(SOURCE_DIR).filter((f) => VALID_EXT.has(extname(f).toLowerCase()))
    : []

  if (files.length === 0) {
    writeFileSync(
      MANIFEST_PATH,
      JSON.stringify({ products: [], generatedAt: new Date().toISOString() }, null, 2)
    )
    console.log('No product images found in /products. Wrote empty manifest.')
    return
  }

  const products = []

  for (const file of files) {
    const srcPath = join(SOURCE_DIR, file)
    const ext = extname(file).toLowerCase()
    // Normalize everything to web-friendly jpg on the way out, capped at a
    // sane max dimension so the repo/site stays light.
    const destName = basename(file, ext) + '.jpg'
    const destPath = join(OUT_DIR, destName)

    try {
      const image = sharp(srcPath).rotate() // auto-orient using EXIF
      const resized = image.resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })

      const { data, info } = await resized.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true })

      const lab = extractDominantLab({ data, info })
      const hex = labToHex(lab)

      await resized.clone().jpeg({ quality: 88 }).toFile(destPath)

      products.push({
        id: basename(file, ext).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: titleCaseFromFilename(file),
        image: `products/${destName}`,
        lab,
        hex,
      })
      console.log(`✓ ${file} -> "${titleCaseFromFilename(file)}" (${hex})`)
    } catch (err) {
      console.warn(`⚠ Skipped ${file}: ${err.message}`)
    }
  }

  products.sort((a, b) => a.name.localeCompare(b.name))
  writeFileSync(
    MANIFEST_PATH,
    JSON.stringify({ products, generatedAt: new Date().toISOString() }, null, 2)
  )
  console.log(`\nWrote manifest with ${products.length} product(s) to ${MANIFEST_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
