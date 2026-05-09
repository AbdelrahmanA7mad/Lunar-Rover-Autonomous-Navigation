import { MODE_LABELS } from '../lib/constants'

export default function FloatingControls({
  mode, step, epsilon, outcome,
  models, modelName, selectedModel,
  maps, selectedMap,
  showTrail, speedLabelText,
  onTrain, onRun, onStop, onNewMap, onToggleTrail,
  onLoadModel, onModelName, onSaveModel,
  onLoadMap,
  onSpeed
}) {
  return (
    <div id="floating-controls">
      <div className="row">
        <button id="btn-train" onClick={onTrain}>TRAIN</button>
        <button id="btn-run" onClick={onRun}>RUN</button>
        <button id="btn-stop" onClick={onStop}>STOP</button>
      </div>
      <div className="row">
        <button style={{ flex: 1 }} onClick={onNewMap}>NEW MAP</button>
        <button onClick={onToggleTrail}>{`PATH: ${showTrail ? 'ON' : 'OFF'}`}</button>
      </div>

      <div className="label">LOAD MAP</div>
      <select value={selectedMap} onChange={(e) => e.target.value && onLoadMap(e.target.value)}>
        <option value="">-- Select Map --</option>
        {maps.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>

      <div className="label">LOAD MODEL</div>
      <select value={selectedModel} onChange={(e) => e.target.value && onLoadModel(e.target.value)}>
        <option value="">-- Select Model --</option>
        {models.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>

      <div className="row">
        <input style={{ flex: 1 }} value={modelName} onChange={(e) => onModelName(e.target.value)} placeholder="model_name" />
        <button onClick={onSaveModel}>SAVE</button>
      </div>
      <div className="row"><span className="label">STEP</span><span>{step}</span><span className="label" style={{ marginLeft: 'auto' }}>EPS</span><span>{epsilon}</span></div>
      <div className="row"><span className="label">OUTCOME</span><span>{outcome}</span><span className="label" style={{ marginLeft: 'auto' }}>MODE</span><span>{MODE_LABELS[mode] || mode.toUpperCase()}</span></div>
      <div className="row"><span className="label">SPEED</span><span style={{ marginLeft: 'auto' }}>{speedLabelText}</span></div>
      <input type="range" min="0" max="0.9" step="0.01" defaultValue="0.12" dir="rtl" onInput={(e) => onSpeed(parseFloat(e.target.value))} />
    </div>
  )
}
