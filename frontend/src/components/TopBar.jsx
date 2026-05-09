import { MODE_LABELS } from '../lib/constants'

export default function TopBar({ mode, episode, trained, reward, successRate }) {
  return (
    <div id="bar">
      <div className="logo">LUNAR ROVER</div>
      <div id="mode-pill" className={mode === 'idle' ? '' : mode}>{MODE_LABELS[mode] || mode.toUpperCase()}</div>
      <div className="top-stats">
        <div>EPISODE<b>{episode}</b></div>
        <div>TRAINED<b>{trained}</b></div>
        <div>REWARD<b>{reward}</b></div>
        <div>SUCCESS<b>{successRate}</b></div>
      </div>
    </div>
  )
}
