import { useCallback, useEffect, useRef, useState } from 'react'
import { detectFaceLandmarks, buildLipMask, getLipBoundingBox, debugDrawLipOutline } from '../lib/lipDetection.js'
import { recolorLips, rgbToLab, classifyUndertone } from '../lib/colorScience.js'

const MAX_DIMENSION = 1400 // cap decode size for performance

export default function PhotoStage({
  personPhoto,
  setPersonPhoto,
  lipData,
  setLipData,
  detectionState,
  setDetectionState,
  selectedProduct,
  intensity,
}) {
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  const loadImageFile = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith('image/')) return
      setDetectionState('detecting')
      setLipData(null)

      const objectUrl = URL.createObjectURL(file)
      const img = new Image()
      img.onload = async () => {
        // Downscale for performance while keeping enough resolution for the mask
        let { width, height } = img
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        URL.revokeObjectURL(objectUrl)
        setPersonPhoto({ canvas, width, height })

        try {
          const landmarks = await detectFaceLandmarks(canvas)
          if (!landmarks) {
            setDetectionState('no-face')
            return
          }
          const mask = buildLipMask(landmarks, width, height, Math.max(1.5, width * 0.0012))
          const boundingBox = getLipBoundingBox(landmarks, width, height)

          const imageData = ctx.getImageData(0, 0, width, height)
          let sumR = 0,
            sumG = 0,
            sumB = 0,
            n = 0
          for (let p = 0; p < width * height; p++) {
            if (mask[p] > 0.6) {
              const i = p * 4
              sumR += imageData.data[i]
              sumG += imageData.data[i + 1]
              sumB += imageData.data[i + 2]
              n++
            }
          }
          const naturalLab =
            n > 0 ? rgbToLab([sumR / n, sumG / n, sumB / n]) : [55, 25, 12]
          const undertone = classifyUndertone(naturalLab)

          setLipData({ mask, naturalLab, undertone, boundingBox, landmarks })
          setDetectionState('done')
        } catch (err) {
          console.error('Face detection failed:', err)
          setDetectionState('error')
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        setDetectionState('error')
      }
      img.src = objectUrl
    },
    [setPersonPhoto, setLipData, setDetectionState]
  )

  // Re-render the canvas whenever product, intensity, or photo changes
  useEffect(() => {
    if (!personPhoto || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = personPhoto.width
    canvas.height = personPhoto.height
    const ctx = canvas.getContext('2d')

    if (!lipData || !selectedProduct) {
      ctx.drawImage(personPhoto.canvas, 0, 0)
      return
    }

    const sourceCtx = personPhoto.canvas.getContext('2d')
        const sourceImageData = sourceCtx.getImageData(0, 0, personPhoto.width, personPhoto.height)
            const recolored = recolorLips(sourceImageData, lipData.mask, selectedProduct.lab, {
                  intensity,
                        glossPreserve: 0.35,
                            })
                                ctx.putImageData(recolored, 0, 0)

                                    // Debug: append ?debugLips=1 to the URL to overlay the raw detected
                                        // landmark points/outline on top of the result.
                                            if (new URLSearchParams(window.location.search).get('debugLips') === '1' && lipData.landmarks) {
                                                  debugDrawLipOutline(ctx, lipData.landmarks, personPhoto.width, personPhoto.height)
                                                      }
                                                        }, [personPhoto, lipData, selectedProduct, intensity])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) loadImageFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) loadImageFile(file)
  }

  const handleReset = () => {
    setPersonPhoto(null)
    setLipData(null)
    setDetectionState('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (!personPhoto) {
    return (
      <div
        className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
        }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
          <rect x="4" y="8" width="32" height="26" rx="1" stroke="var(--ink-soft)" strokeWidth="1.5" />
          <circle cx="14" cy="17" r="3" stroke="var(--ink-soft)" strokeWidth="1.5" />
          <path d="M4 28l9-8 6 5 8-9 9 10" stroke="var(--ink-soft)" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        <p className="upload-title">Add a photo to try on shades</p>
        <p className="upload-hint">Drop an image here, or click to choose one — front-facing, lips visible</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="visually-hidden"
        />
      </div>
    )
  }

  return (
    <div className="stage-canvas-wrap">
      <canvas ref={canvasRef} className="stage-canvas" />

      {detectionState === 'detecting' && (
        <div className="stage-overlay">
          <p>Finding your lips…</p>
        </div>
      )}

      {detectionState === 'no-face' && (
        <div className="stage-overlay stage-overlay-warn">
          <p>Couldn&rsquo;t find a face in that photo.</p>
          <p className="stage-overlay-hint">Try a clearer, front-facing photo with lips visible.</p>
          <button className="btn-ghost" onClick={handleReset}>
            Try another photo
          </button>
        </div>
      )}

      {detectionState === 'error' && (
        <div className="stage-overlay stage-overlay-warn">
          <p>Something went wrong reading that image.</p>
          <button className="btn-ghost" onClick={handleReset}>
            Try another photo
          </button>
        </div>
      )}

      {detectionState === 'done' && (
        <button className="btn-ghost stage-reset" onClick={handleReset}>
          Use a different photo
        </button>
      )}
    </div>
  )
}
