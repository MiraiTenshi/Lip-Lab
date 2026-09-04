export default function ShadeRail({ products, selectedId, onSelect }) {
  return (
    <div className="shade-rail">
      <h2 className="rail-heading">Shades</h2>
      <p className="rail-count">
        {products.length} product{products.length === 1 ? '' : 's'}
      </p>
      <ul className="shade-list" role="listbox" aria-label="Select a shade">
        {products.map((product) => {
          const isSelected = product.id === selectedId
          return (
            <li key={product.id}>
              <button
                className={`shade-item ${isSelected ? 'shade-item-selected' : ''}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(product.id)}
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
    </div>
  )
}
