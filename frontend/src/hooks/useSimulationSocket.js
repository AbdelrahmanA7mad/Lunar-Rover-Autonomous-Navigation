import { useEffect, useRef, useState } from 'react'

export function useSimulationSocket(onState) {
  const wsRef = useRef(null)
  const onStateRef = useRef(onState)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    onStateRef.current = onState
  }, [onState])

  useEffect(() => {
    let cancelled = false

    const connect = () => {
      const ws = new WebSocket(`ws://${window.location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => !cancelled && setConnected(true)
      ws.onerror = () => !cancelled && setConnected(false)
      ws.onclose = () => {
        if (cancelled) return
        setConnected(false)
        setTimeout(connect, 2000)
      }
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data)
        onStateRef.current(data)
      }
    }

    connect()
    return () => {
      cancelled = true
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  function send(payload) {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload))
      return true
    }
    return false
  }

  return { connected, send }
}
