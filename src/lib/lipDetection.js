import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

// MediaPipe FaceMesh landmark indices that trace the lip boundary, drawn
// from Google's canonical FACEMESH_LIPS connections. Order matters here:
// each array must trace a single continuous loop (corner -> along one
// edge -> corner -> along the other edge -> back to start) for the canvas
// polygon fill to cover the whole lip rather than skipping sections.

// Outer lip contour: right corner -> across the top (outer edge) -> left
// corner -> across the bottom (outer edge) -> back to right corner.
const OUTER_LIP_INDICES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84,
    181, 91, 146, 61,
    ]

// Inner lip contour (the inner edge, i.e. where the mouth opening begins) —
// used to exclude teeth/mouth-interior from the mask so we don't tint teeth.
// Same corner -> top -> corner -> bottom -> back-to-start ordering.
const INNER_LIP_INDICES = [
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14,
      87, 178, 88, 95, 78,
      ]

let landmarkerPromise = null

/**
 * Lazily create and cache the FaceLandmarker instance. Loads the WASM
 * runtime + model from a CDN on first use (cached by the browser after).
 */
function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      )
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'CPU',
        },
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
        runningMode: 'IMAGE',
        numFaces: 1,
      })
    })()
  }
  return landmarkerPromise
}

/**
 * Detect face landmarks in an HTMLImageElement (or canvas/video).
 * Returns null if no face was found.
 */
export async function detectFaceLandmarks(imageElement) {
  const landmarker = await getLandmarker()
  const result = landmarker.detect(imageElement)
  if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
    return null
  }
  return result.faceLandmarks[0] // array of {x, y, z} normalized 0..1
}

/**
 * Build a soft-edged lip mask (Float32Array, values 0..1, length width*height)
 * from face landmarks. The mask is 1.0 well inside the lip contour, fades to
 * 0 over a feather region at the boundary, and is 0 outside — and it also
 * excludes the mouth interior (teeth/tongue/dark cavity) via the inner
 * contour, so open-mouth photos don't get teeth tinted.
 */
export function buildLipMask(landmarks, width, height, featherPx = 4) {
  const outerPts = OUTER_LIP_INDICES.map((idx) => ({
    x: landmarks[idx].x * width,
    y: landmarks[idx].y * height,
  }))
  const innerPts = INNER_LIP_INDICES.map((idx) => ({
    x: landmarks[idx].x * width,
    y: landmarks[idx].y * height,
  }))

  // Rasterize outer polygon minus inner polygon onto an offscreen canvas,
  // then feather with a small blur pass done manually on the alpha channel.
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  outerPts.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)))
  ctx.closePath()
  // Cut out the mouth interior using even-odd fill rule
  ctx.moveTo(innerPts[0].x, innerPts[0].y)
  for (let i = innerPts.length - 1; i >= 0; i--) {
    ctx.lineTo(innerPts[i].x, innerPts[i].y)
  }
  ctx.closePath()
  ctx.fill('evenodd')

  // Feather the mask edges with a gaussian-ish blur for a natural transition
  ctx.filter = `blur(${featherPx}px)`
  const blurred = document.createElement('canvas')
  blurred.width = width
  blurred.height = height
  const bctx = blurred.getContext('2d')
  bctx.filter = `blur(${featherPx}px)`
  bctx.drawImage(canvas, 0, 0)

  const imgData = bctx.getImageData(0, 0, width, height)
  const mask = new Float32Array(width * height)
  for (let p = 0; p < width * height; p++) {
    mask[p] = imgData.data[p * 4] / 255 // red channel carries the white-fill alpha after blur
  }
  return mask
}

/** Convenience: bounding box of the outer lip landmarks, in pixel coords. */
export function getLipBoundingBox(landmarks, width, height) {
  const pts = OUTER_LIP_INDICES.map((idx) => ({
    x: landmarks[idx].x * width,
    y: landmarks[idx].y * height,
  }))
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}
