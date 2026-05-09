import { useEffect, useRef } from 'react'
import { GRID_SIZE } from '../lib/constants'

export function usePixiRenderer(hostRef) {
  const apiRef = useRef(null)

  useEffect(() => {
    if (!hostRef.current) return

    let disposed = false
    let cleanup = null

    ;(async () => {
      const PIXI = await import('pixi.js')
      if (disposed || !hostRef.current) return

      const app = new PIXI.Application({
        background: '#0b1119',
        antialias: false,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      })
      hostRef.current.appendChild(app.view)

      const world = new PIXI.Container()
      const terrainLayer = new PIXI.Container()
      const trailLayer = new PIXI.Container()
      const actorLayer = new PIXI.Container()
      world.addChild(terrainLayer, trailLayer, actorLayer)
      app.stage.addChild(world)

      const targetGfx = new PIXI.Graphics()
      const roverGfx = new PIXI.Graphics()
      actorLayer.addChild(targetGfx, roverGfx)

      let cellSize = 24
      let offsetX = 0
      let offsetY = 0
      let roverPx = { x: 0, y: 0 }
      let roverTargetPx = { x: 0, y: 0 }

      function toPixel(pos) {
        return {
          x: offsetX + pos[0] * cellSize + cellSize * 0.5,
          y: offsetY + pos[1] * cellSize + cellSize * 0.5,
        }
      }

      function drawGrid() {
        terrainLayer.removeChildren()
        const g = new PIXI.Graphics()
        g.lineStyle(1, 0x1e2a39, 1)
        g.beginFill(0x0e1622, 1)
        g.drawRect(offsetX, offsetY, GRID_SIZE * cellSize, GRID_SIZE * cellSize)
        g.endFill()
        for (let i = 0; i <= GRID_SIZE; i++) {
          const x = offsetX + i * cellSize
          const y = offsetY + i * cellSize
          g.moveTo(x, offsetY)
          g.lineTo(x, offsetY + GRID_SIZE * cellSize)
          g.moveTo(offsetX, y)
          g.lineTo(offsetX + GRID_SIZE * cellSize, y)
        }
        terrainLayer.addChild(g)
      }

      function resize() {
        if (!hostRef.current) return
        const w = hostRef.current.clientWidth
        const h = hostRef.current.clientHeight
        app.renderer.resize(w, h)
        cellSize = Math.floor(Math.min(w, h) / (GRID_SIZE + 2))
        offsetX = Math.floor((w - GRID_SIZE * cellSize) / 2)
        offsetY = Math.floor((h - GRID_SIZE * cellSize) / 2)
        drawGrid()
      }

      app.ticker.add(() => {
        roverPx.x += (roverTargetPx.x - roverPx.x) * 0.23
        roverPx.y += (roverTargetPx.y - roverPx.y) * 0.23
        roverGfx.clear()
        roverGfx.beginFill(0x00c8ff, 1)
        roverGfx.drawCircle(roverPx.x, roverPx.y, cellSize * 0.26)
        roverGfx.endFill()
      })

      resize()
      window.addEventListener('resize', resize)

      apiRef.current = {
        drawTerrain(craters = [], rocks = []) {
          drawGrid()
          const t = new PIXI.Graphics()
          craters.forEach(([x, y]) => {
            const px = offsetX + x * cellSize
            const py = offsetY + y * cellSize
            t.beginFill(0x0a0a0a, 1)
            t.drawCircle(px + cellSize / 2, py + cellSize / 2, cellSize * 0.35)
            t.endFill()
          })
          rocks.forEach(([x, y]) => {
            const px = offsetX + x * cellSize
            const py = offsetY + y * cellSize
            t.beginFill(0x7e8a98, 1)
            t.drawRect(px + cellSize * 0.22, py + cellSize * 0.22, cellSize * 0.56, cellSize * 0.56)
            t.endFill()
          })
          terrainLayer.addChild(t)
        },
        drawActors(roverPos, targetPos) {
          targetGfx.clear()
          const target = toPixel(targetPos)
          targetGfx.beginFill(0x00e87a, 1)
          targetGfx.drawRect(target.x - cellSize * 0.28, target.y - cellSize * 0.28, cellSize * 0.56, cellSize * 0.56)
          targetGfx.endFill()
          roverTargetPx = toPixel(roverPos)
          if (roverPx.x === 0 && roverPx.y === 0) roverPx = { ...roverTargetPx }
        },
        updateTrail(points, mode, showTrail) {
          trailLayer.removeChildren()
          if (!showTrail || points.length < 2) return
          const g = new PIXI.Graphics()
          g.lineStyle(2, mode === 'training' ? 0xffcc00 : 0x00e87a, 0.8)
          g.moveTo(points[0].x, points[0].y)
          for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y)
          trailLayer.addChild(g)
        },
        toPixel,
      }

      cleanup = () => {
        window.removeEventListener('resize', resize)
        app.destroy(true, true)
      }
    })()

    return () => {
      disposed = true
      if (cleanup) cleanup()
      apiRef.current = null
    }
  }, [hostRef])

  return apiRef
}
