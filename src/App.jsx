import { useEffect, useState } from 'react'
import Header from './components/Header.jsx'
import PhotoStage from './components/PhotoStage.jsx'
import ShadePicker from './components/ShadePicker.jsx'
import ReadoutStrip from './components/ReadoutStrip.jsx'
import IntensityControl from './components/IntensityControl.jsx'
import EmptyProductsNotice from './components/EmptyProductsNotice.jsx'
import './styles/app.css'

const MANIFEST_URL = `${import.meta.env.BASE_URL}products/manifest.json`

export default function App() {
  const [products, setProducts] = useState(null) // null = loading
  const [selectedId, setSelectedId] = useState(null)
  const [intensity, setIntensity] = useState(0.85)
  const [personPhoto, setPersonPhoto] = useState(null) // { element, width, height }
  const [lipData, setLipData] = useState(null) // { mask, naturalLab, undertone, boundingBox }
  const [detectionState, setDetectionState] = useState('idle') // idle | detecting | done | no-face | error

  useEffect(() => {
    fetch(MANIFEST_URL)
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products || [])
        if (data.products && data.products.length > 0) {
          setSelectedId(data.products[0].id)
        }
      })
      .catch(() => setProducts([]))
  }, [])

  const selectedProduct = products?.find((p) => p.id === selectedId) || null

  return (
    <div className="app-shell">
      <Header />

      <main className="workshop">
        <section className="stage-pane" aria-label="Photo and live preview">
          <PhotoStage
            personPhoto={personPhoto}
            setPersonPhoto={setPersonPhoto}
            lipData={lipData}
            setLipData={setLipData}
            detectionState={detectionState}
            setDetectionState={setDetectionState}
            selectedProduct={selectedProduct}
            intensity={intensity}
          />

          <div className="controls-row">
            {products === null && <p className="rail-loading">Loading shade library…</p>}
            {products !== null && products.length === 0 && <EmptyProductsNotice />}
            {products && products.length > 0 && (
              <ShadePicker products={products} selectedId={selectedId} onSelect={setSelectedId} />
            )}

            {lipData && (
              <IntensityControl intensity={intensity} setIntensity={setIntensity} />
            )}
          </div>

          {lipData && <ReadoutStrip lipData={lipData} selectedProduct={selectedProduct} />}
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Your photo is processed entirely in your browser and is never uploaded anywhere.
          Refresh the page and it&rsquo;s gone.
        </p>
      </footer>
    </div>
  )
}
