import { useEffect, useRef } from 'react'

export default function RewardChart({ rewards }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    let active = true

    ;(async () => {
      const mod = await import('chart.js/auto')
      if (!active || !canvasRef.current) return
      const Chart = mod.default
      const ctx = canvasRef.current.getContext('2d')
      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#00c8ff', backgroundColor: 'rgba(0,200,255,.12)', pointRadius: 0, fill: true, tension: 0.25 }] },
        options: { animation: false, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      })
    })()

    return () => {
      active = false
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.data.labels = rewards.map((r) => r.episode)
    chartRef.current.data.datasets[0].data = rewards.map((r) => r.reward)
    chartRef.current.update('none')
  }, [rewards])

  return (
    <div id="chart-float">
      <div id="chart-title">REWARD / EPISODE</div>
      <canvas ref={canvasRef} />
    </div>
  )
}
