// ---------------------------------------------------------------------------
// Color science core.
//
// Everything here works in CIE LAB space rather than raw RGB. RGB mixes light
// the way a screen emits it, not the way a pigment sits on skin — blending
// two RGB values head-on gives you a muddy average, not a plausible lipstick.
// LAB separates *lightness* (L) from *hue+chroma* (a/b), which is what lets
// us keep a person's natural lip shading (highlights, the cupid's bow shadow,
// texture) while swapping in a product's actual color.
// ---------------------------------------------------------------------------

// --- sRGB <-> Linear RGB -----------------------------------------------------

function srgbToLinear(c) {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function linearToSrgb(c) {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  return Math.max(0, Math.min(255, Math.round(v * 255)))
}

// --- Linear RGB <-> XYZ (D65) -----------------------------------------------

const RGB_TO_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
]
const XYZ_TO_RGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252],
]

// D65 reference white
const REF_X = 0.95047
const REF_Y = 1.0
const REF_Z = 1.08883

function rgbToXyz([r, g, b]) {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  return [
    RGB_TO_XYZ[0][0] * lr + RGB_TO_XYZ[0][1] * lg + RGB_TO_XYZ[0][2] * lb,
    RGB_TO_XYZ[1][0] * lr + RGB_TO_XYZ[1][1] * lg + RGB_TO_XYZ[1][2] * lb,
    RGB_TO_XYZ[2][0] * lr + RGB_TO_XYZ[2][1] * lg + RGB_TO_XYZ[2][2] * lb,
  ]
}

function xyzToRgb([x, y, z]) {
  const r = XYZ_TO_RGB[0][0] * x + XYZ_TO_RGB[0][1] * y + XYZ_TO_RGB[0][2] * z
  const g = XYZ_TO_RGB[1][0] * x + XYZ_TO_RGB[1][1] * y + XYZ_TO_RGB[1][2] * z
  const b = XYZ_TO_RGB[2][0] * x + XYZ_TO_RGB[2][1] * y + XYZ_TO_RGB[2][2] * z
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)]
}

// --- XYZ <-> LAB -------------------------------------------------------------

function fLab(t) {
  const d = 6 / 29
  return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29
}

function fLabInv(t) {
  const d = 6 / 29
  return t > d ? t * t * t : 3 * d * d * (t - 4 / 29)
}

export function rgbToLab([r, g, b]) {
  const [x, y, z] = rgbToXyz([r, g, b])
  const fx = fLab(x / REF_X)
  const fy = fLab(y / REF_Y)
  const fz = fLab(z / REF_Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export function labToRgb([L, a, b]) {
  const fy = (L + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const x = fLabInv(fx) * REF_X
  const y = fLabInv(fy) * REF_Y
  const z = fLabInv(fz) * REF_Z
  return xyzToRgb([x, y, z])
}

// --- Undertone classification ------------------------------------------------
//
// Undertone is estimated from the hue angle of the a/b vector: redder+more
// yellow (a>0, b leaning positive, hue angle roughly 15-55deg) reads warm;
// redder+more blue/pink (b near zero or negative) reads cool. This is a
// simplification of real skin-tone science but works well for lip pixels,
// which sit in a narrow hue band to begin with.

export function classifyUndertone(labColor) {
  const [, a, b] = labColor
  const hueAngle = (Math.atan2(b, a) * 180) / Math.PI
  if (hueAngle > 35) return 'warm'
  if (hueAngle < 15) return 'cool'
  return 'neutral'
}

// --- Product color extraction ------------------------------------------------

/**
 * Given raw RGBA pixel data (Uint8ClampedArray) of a *cropped* product photo
 * that shows lips wearing the product, extract a representative LAB color.
 *
 * Strategy: sample almost the whole frame (a small margin only, since photos
 * vary widely in how tightly they crop the lips — assuming a fixed central
 * "lips are here" box breaks badly on close-up product photos where lips
 * fill nearly the entire frame). Reject background/near-gray pixels by
 * saturation, then — critically — take the darkest 20th percentile of the
 * *remaining* saturated pixels, not the median of all of them.
 *
 * That last step matters: real lip photos are strongly bimodal in
 * lightness. Glossy highlights and the soft skin-to-lip transition zone are
 * pale but still count as "saturated enough," and on many photos those
 * pale pixels substantially outnumber the fuller, truer-color pixels where
 * the product sits thickest — so a plain median (even a saturation-
 * filtered one) gets pulled toward the pale highlight cluster rather than
 * the actual product color. The darkest, most pigment-dense pixels are the
 * most representative of the product's true color; highlights by
 * definition wash toward pale, so biasing away from them (rather than
 * averaging them in) is what keeps browns brown and reds red instead of
 * both drifting toward a shared pale pink/orange.
 */
export function extractDominantLabColor(imageData, opts = {}) {
  const { width, height, data } = imageData
  const margin = opts.margin ?? 0.08
  const xStart = Math.floor(width * margin)
  const xEnd = Math.floor(width * (1 - margin))
  const yStart = Math.floor(height * margin)
  const yEnd = Math.floor(height * (1 - margin))

  const samples = []
  for (let y = yStart; y < yEnd; y += 2) {
    for (let x = xStart; x < xEnd; x += 2) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const alpha = data[i + 3]
      if (alpha < 200) continue

      // Reject near-gray pixels (background, or areas with no real color)
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const lightness = (max + min) / 2
      const sat = max === min ? 0 : (max - min) / (255 - Math.abs(2 * lightness - 255))
      if (sat < 0.15) continue

      samples.push({ lightness, rgb: [r, g, b] })
    }
  }

  if (samples.length === 0) {
    // Fallback: whole-frame average without filtering, for unusual photos
    // where nothing passes the saturation check (e.g. a very pale nude).
    const fallback = []
    for (let y = yStart; y < yEnd; y += 3) {
      for (let x = xStart; x < xEnd; x += 3) {
        const i = (y * width + x) * 4
        fallback.push(rgbToLab([data[i], data[i + 1], data[i + 2]]))
      }
    }
    fallback.sort((s1, s2) => s1[0] - s2[0])
    return fallback[Math.floor(fallback.length / 2)] || [50, 20, 10]
  }

  samples.sort((s1, s2) => s1.lightness - s2.lightness)
  const darkestSlice = samples.slice(0, Math.max(1, Math.floor(samples.length * 0.2)))
  const labs = darkestSlice.map((s) => rgbToLab(s.rgb))
  labs.sort((l1, l2) => l1[0] - l2[0])
  return labs[Math.floor(labs.length / 2)] || [50, 20, 10]
}

// --- LAB <-> LCh (polar form: Lightness, Chroma, hue angle) ----------------
//
// Straight-line interpolation between two LAB colors' a/b values can dip
// toward gray partway through the blend, even when both endpoints are
// vivid — a well-known artifact of Cartesian LAB blending. Interpolating in
// LCh instead (chroma and hue as separate polar values) avoids that dip:
// chroma blends toward a genuinely intermediate saturation, and hue takes
// the shorter angular path, so a sheer application of a vivid product still
// reads as "that color, softly" instead of "a grayish version of it."

function labToLch([L, a, b]) {
  const c = Math.sqrt(a * a + b * b)
  let h = Math.atan2(b, a)
  return [L, c, h]
}

function lchToLab([L, c, h]) {
  return [L, c * Math.cos(h), c * Math.sin(h)]
}

/** Interpolate two hue angles (radians) along the shorter arc. */
function lerpHue(h1, h2, t) {
  let diff = h2 - h1
  while (diff > Math.PI) diff -= 2 * Math.PI
  while (diff < -Math.PI) diff += 2 * Math.PI
  return h1 + diff * t
}

// --- Lip recoloring ----------------------------------------------------------

/**
 * Recolor a person's lips using their natural lightness/shading, the
 * product's hue+chroma, and undertone-aware harmonization.
 *
 * @param {ImageData} personImageData - full photo pixel data (will be copied, not mutated)
 * @param {Float32Array} lipMask - same width*height, values 0..1 (soft mask, 1 = fully lip)
 * @param {[number,number,number]} productLab - product's representative LAB color
 * @param {object} opts
 * @param {number} opts.intensity - 0..1, how strongly to apply product color (product "opacity")
 * @param {number} opts.glossPreserve - 0..1, how much to preserve bright specular highlights as white/light rather than tinting them fully
 * @returns {ImageData} new ImageData with lips recolored
 */
export function recolorLips(personImageData, lipMask, productLab, opts = {}) {
  const { width, height, data } = personImageData
  const intensity = opts.intensity ?? 0.4
  const glossPreserve = opts.glossPreserve ?? 0.35

  const out = new ImageData(new Uint8ClampedArray(data), width, height)
  const outData = out.data

  // First pass: find the median natural lip LAB (for undertone + reference midtone)
  let sumL = 0,
    count = 0
  const labCache = new Array(width * height)
  for (let p = 0; p < width * height; p++) {
    const m = lipMask[p]
    if (m < 0.15) continue
    const i = p * 4
    const lab = rgbToLab([data[i], data[i + 1], data[i + 2]])
    labCache[p] = lab
    sumL += lab[0]
    count++
  }
  const naturalLabAvg = count > 0 ? sumL / count : 50
  const midtoneL = naturalLabAvg

  const [prodL, prodA, prodB] = productLab
  const [, prodC, prodH] = labToLch(productLab)
  const personUndertone = (() => {
    // Sample a rough undertone estimate from natural lip pixels
    let aSum = 0,
      bSum = 0,
      n = 0
    for (let p = 0; p < width * height; p++) {
      if (lipMask[p] > 0.5 && labCache[p]) {
        aSum += labCache[p][1]
        bSum += labCache[p][2]
        n++
      }
    }
    if (n === 0) return 'neutral'
    return classifyUndertone([50, aSum / n, bSum / n])
  })()

  // Undertone harmonization: nudge product hue slightly toward the person's
  // undertone rather than fighting it. This is subtle by design (max ~8deg
  // hue rotation) — real MUA color-correction, not a filter.
  const hueShiftDeg = personUndertone === 'warm' ? 6 : personUndertone === 'cool' ? -6 : 0
  const adjProdH = prodH + (hueShiftDeg * Math.PI) / 180

  // Intensity curve: real lipstick opacity isn't linear — a "sheer" swipe
  // (low intensity) still shows a good amount of true pigment hue, while
  // pushing toward "full pigment" (high intensity) approaches the product's
  // actual chroma rather than overshooting past it. Easing intensity through
  // a gentle curve (rather than using it as a raw linear blend factor)
  // keeps low settings from reading as "washed out gray" and high settings
  // from reading as "oversaturated/glowing."
  const easedIntensity = Math.pow(intensity, 0.7)

  for (let p = 0; p < width * height; p++) {
    const m = lipMask[p]
    // Skip only truly-zero pixels (pure performance optimization — these
    // contribute nothing regardless of curve). The falloff curve below,
    // not a cutoff, is what keeps color from bleeding onto skin: a hard
    // cutoff at a mid-range mask value creates a visible discontinuity
    // (skin jumps from 0% to a noticeable blend at fixed mask threshold),
    // which reads as a hard bright ring right at the mask boundary —
    // exactly the artifact a soft cosmetic falloff should avoid.
    if (m <= 0.005) continue
    const i = p * 4
    const naturalLab = labCache[p] || rgbToLab([data[i], data[i + 1], data[i + 2]])
    const [nL] = naturalLab

    // Preserve specular highlights: pixels much brighter than the lip
    // midtone are glossy highlights — pull them back toward natural color
    // rather than fully tinting, so the lips keep dimensional shine.
    const highlightFactor = Math.max(0, Math.min(1, (nL - midtoneL) / 35))
    const highlightPreserve = highlightFactor * glossPreserve

    // Target lightness: this should be able to fully express the
    // product's actual lightness at high intensity — a genuinely dark
    // brown or deep berry needs its low L to come through, or it reads as
    // a lighter, more orange/pink version of itself no matter how
    // saturated its hue is. Only a small fixed nudge toward the person's
    // natural lightness is applied here (~15%), to keep some believable
    // "product sitting on real skin" quality — the actual natural-shading
    // preservation (highlights stay bright, texture reads through) comes
    // from blending against nL via blendStrength below, which already
    // scales correctly with the intensity slider and mask falloff.
    const targetL = prodL * 0.85 + nL * 0.15

    // Chroma modulation: pixels in shadow/crease areas (low L relative to
    // midtone) get slightly reduced saturation, mimicking how pigment
    // gathers less light in recesses — avoids a flat "sticker" look.
    const shadowFactor = Math.max(0.55, Math.min(1, 1 - (midtoneL - nL) / 120))

    // Steepen the mask falloff with a power curve (continuous, no cutoff
    // discontinuity) so pixels solidly inside the lip reach near-full
    // blend quickly, while the feathered edge tapers smoothly all the way
    // to zero — avoiding both "bleeding past the lip line" (old bug: flat
    // linear falloff) and "hard bright ring at a fixed threshold" (a
    // regression from an earlier fix that used a hard cutoff instead of a
    // continuous curve).
    const easedM = Math.pow(m, 1.8)
    const blendStrength = easedIntensity * (1 - highlightPreserve) * easedM

    // Blend in LCh (polar) space: lightness stays mostly the person's own
    // (shading/highlights preserved), chroma and hue move toward the
    // product's values along the natural, non-dipping polar path.
    const [, natC, natH] = labToLch(naturalLab)
    const finalL = nL * (1 - blendStrength) + targetL * blendStrength
    const finalC = (natC * (1 - blendStrength) + prodC * shadowFactor * blendStrength)
    const finalH = lerpHue(natH, adjProdH, blendStrength)
    const [, finalA, finalB] = lchToLab([finalL, finalC, finalH])

    const [r, g, b] = labToRgb([finalL, finalA, finalB])
    outData[i] = r
    outData[i + 1] = g
    outData[i + 2] = b
    outData[i + 3] = data[i + 3]
  }

  return out
}
