import { useEffect, useRef, useCallback } from 'react'
import useStore from '../store/useStore'

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

export function useSessionWS(sessionId) {
  const wsRef = useRef(null)
  const { setWsConnected, setFacialResult, setSpeechResult,
          setTextResult, setMicroEvents, setFusedResult,
          pushTimelineEntry } = useStore()

  const connect = useCallback(() => {
    if (!sessionId) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_BASE}/ws/session/${sessionId}`)
    wsRef.current = ws

    ws.onopen = () => {
      setWsConnected(true)
      console.log('[WS] connected to session', sessionId)
    }

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'ping') return

        const { modality, data } = msg
        switch (modality) {
          case 'facial':
            setFacialResult(data)
            if (data.dominant) {
              pushTimelineEntry({
                t: Date.now(),
                emotion: data.dominant,
                confidence: data.scores?.find(s => s.emotion === data.dominant)?.confidence ?? 0,
              })
            }
            break
          case 'speech':
            setSpeechResult(data)
            break
          case 'text':
            setTextResult(data)
            break
          case 'micro':
            setMicroEvents(prev => [...(prev || []), data])
            break
          case 'fused':
            setFusedResult(data)
            break
        }
      } catch (err) {
        console.warn('[WS] parse error', err)
      }
    }

    ws.onclose = () => {
      setWsConnected(false)
      console.log('[WS] disconnected')
      // Reconnect after 3s
      setTimeout(() => connect(), 3000)
    }

    ws.onerror = (err) => {
      console.error('[WS] error', err)
      ws.close()
    }
  }, [sessionId])

  const disconnect = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setWsConnected(false)
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect])

  return { connect, disconnect }
}
