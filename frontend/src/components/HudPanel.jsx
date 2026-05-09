export default function HudPanel({ roverPos, targetPos, fps, wsIn }) {
  const dist = roverPos && targetPos ? Math.abs(roverPos[0] - targetPos[0]) + Math.abs(roverPos[1] - targetPos[1]) : '-'
  return (
    <div id="hud">
      <div>ROVER <b>{`(${roverPos?.[0] ?? '-'}, ${roverPos?.[1] ?? '-'})`}</b></div>
      <div>TARGET <b>{`(${targetPos?.[0] ?? '-'}, ${targetPos?.[1] ?? '-'})`}</b></div>
      <div>DIST <b>{dist}</b></div>
      <div>FPS <b>{fps}</b></div>
      <div>WS <b>{wsIn}</b></div>
    </div>
  )
}
