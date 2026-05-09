export default function ConnectionOverlay({ connected }) {
  return (
    <div id="overlay" className={connected ? 'gone' : ''}>
      <div className="loader-spinner"></div>
      <div>CONNECTING TO SIMULATION...</div>
      <div style={{ color: 'var(--muted)', fontSize: '.9rem', fontWeight: '400' }}>Waiting for server on port 8000</div>
    </div>
  )
}
