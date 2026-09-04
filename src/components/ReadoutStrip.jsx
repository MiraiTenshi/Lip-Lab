const UNDERTONE_LABEL = {
  warm: 'Warm',
  cool: 'Cool',
  neutral: 'Neutral',
}

export default function ReadoutStrip({ lipData, selectedProduct }) {
  const { naturalLab, undertone } = lipData

  return (
    <div className="readout-strip" aria-label="Color analysis">
      <div className="readout-item">
        <span className="readout-label">Your lip undertone</span>
        <span className="readout-value">{UNDERTONE_LABEL[undertone] || 'Neutral'}</span>
      </div>
      <div className="readout-divider" aria-hidden="true" />
      <div className="readout-item">
        <span className="readout-label">Natural tone</span>
        <span className="readout-value readout-value-swatch">
          <span
            className="readout-dot"
            style={{ backgroundColor: labToDisplayHex(naturalLab) }}
            aria-hidden="true"
          />
          L {naturalLab[0].toFixed(0)}
        </span>
      </div>
      {selectedProduct && (
        <>
          <div className="readout-divider" aria-hidden="true" />
          <div className="readout-item">
            <span className="readout-label">Applied shade</span>
            <span className="readout-value readout-value-swatch">
              <span
                className="readout-dot"
                style={{ backgroundColor: selectedProduct.hex }}
                aria-hidden="true"
              />
              {selectedProduct.name}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// Lightweight LAB->hex just for the readout dot (avoids importing the full
// color science module's canvas-dependent helpers here)
function labToDisplayHex([L, a, b]) {
  const fy = (L + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const finv = (t) => (t > 6 / 29 ? t ** 3 : 3 * (6 / 29) ** 2 * (t - 4 / 29))
  const x = finv(fx) * 0.95047
  const y = finv(fy) * 1.0
  const z = finv(fz) * 1.08883
  const lin2s = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055)
  let r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
  let g = -0.969266 * x + 1.876011 * y + 0.041556 * z
  let bch = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z
  ;[r, g, bch] = [r, g, bch].map((c) => Math.max(0, Math.min(255, Math.round(lin2s(c) * 255))))
  return `#${[r, g, bch].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
