export default function MissionMenu({ onTrain, onRun, onNewMap, onOpen }) {
  return (
    <div id="menu-screen">
      <div className="menu-card">
        <div className="menu-title">LUNAR ROVER</div>
        <div className="menu-sub">Autonomous Navigation Simulation</div>
        <div className="menu-actions">
          <button className="menu-btn primary" onClick={onTrain}>START TRAINING</button>
          <button className="menu-btn" onClick={onRun}>RUN TRAINED MODEL</button>
          <button className="menu-btn" onClick={onNewMap}>NEW RANDOM MAP</button>
          <button className="menu-btn" onClick={onOpen}>SPECTATOR MODE</button>
        </div>
      </div>
    </div>
  )
}
