export default function Header() {
  return (
    <header className="app-header">
      <div className="app-header-mark" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path
            d="M14 6c-4.5 0-8 2.8-8 7.2 0 2.9 2.3 5.1 5.2 6.3.9.4 1.6 1.1 1.9 2 .1.4.6.4.8 0 .3-.9 1-1.6 1.9-2 2.9-1.2 5.2-3.4 5.2-6.3C21 8.8 18.5 6 14 6z"
            fill="var(--berry)"
          />
        </svg>
      </div>
      <div>
        <h1>Lip Shade Lab</h1>
        <p className="app-header-sub">Try shades on, with real color science</p>
      </div>
    </header>
  )
}
