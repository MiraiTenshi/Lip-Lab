import { useEffect, useRef, useState } from 'react'

export default function ShadePicker({ products, selectedId, onSelect }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const selectedProduct = products.find((p) => p.id === selectedId) || products[0]

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleSelect = (id) => {
    onSelect(id)
    setOpen(false)
  }

  return (
    <div className="shade-picker" ref={containerRef}>
      <button
        type="button"
        className="shade-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="shade-swatch shade-swatch-sm"
          style={{ backgroundColor: selectedProduct?.hex }}
          aria-hidden="true"
        />
        <span className="shade-picker-label">
          <span className="shade-picker-name">{selectedProduct?.name ?? 'Choose a shade'}</span>
          <span className="shade-picker-hex">{selectedProduct?.hex}</span>
        </span>
        <span className="shade-picker-count">{products.length}</span>
        <svg
          className={`shade-picker-chevron ${open ? 'shade-picker-chevron-open' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden="true"
        >
          <path d="M3 5.5L7 9.5L11 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="shade-picker-list" role="listbox" aria-label="Select a shade">
          {products.map((product) => {
            const isSelected = product.id === selectedId
            return (
              <li key={product.id}>
                <button
                  type="button"
                  className={`shade-item ${isSelected ? 'shade-item-selected' : ''}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(product.id)}
                >
                  <span
                    className="shade-swatch"
                    style={{ backgroundColor: product.hex }}
                    aria-hidden="true"
                  />
                  <span className="shade-info">
                    <span className="shade-name">{product.name}</span>
                    <span className="shade-hex">{product.hex}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
