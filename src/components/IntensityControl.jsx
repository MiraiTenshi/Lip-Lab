export default function IntensityControl({ intensity, setIntensity }) {
  return (
    <div className="intensity-control">
      <label htmlFor="intensity-slider" className="intensity-label">
        Intensity
      </label>
      <input
        id="intensity-slider"
        type="range"
        min="0.15"
        max="0.65"
        step="0.01"
        value={intensity}
        onChange={(e) => setIntensity(parseFloat(e.target.value))}
        className="intensity-slider"
      />
      <span className="intensity-value">{Math.round(intensity * 100)}%</span>
    </div>
  )
}
