export default function EmptyProductsNotice() {
  return (
    <div className="empty-products">
      <h2 className="rail-heading">Shades</h2>
      <p>No products yet.</p>
      <p className="empty-products-hint">
        Add photos to the <code>/products</code> folder in the repository (filename becomes
        the product name) and rebuild the site.
      </p>
    </div>
  )
}
