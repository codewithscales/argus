import { useEffect, useRef } from 'react'
import type { WsEvent } from '@/types'
import { useRunStreamStore } from '@/stores/runStream'

export function useRunStream(runId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null)
  const { addOrUpdateSpan, setRunStatus, setRunOutput, setConnected, reset } = useRunStreamStore()

  useEffect(() => {
    if (!runId) return
    reset()

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${protocol}//${location.host}/ws/runs/${runId}`)
    wsRef.current = socket

    socket.onopen  = () => setConnected(true)
    socket.onclose = () => setConnected(false)

    socket.onmessage = (e: MessageEvent) => {
      const event: WsEvent = JSON.parse(e.data as string)
      switch (event.event) {
        case 'span_start':
        case 'span_end':
          addOrUpdateSpan(event.span)
          break
        case 'run_start':
          setRunStatus(event.run.status)
          break
        case 'run_end':
          setRunStatus(event.run.status)
          if (event.run.output) setRunOutput(event.run.output)
          break
        case 'error':
          setRunStatus('failed')
          break
      }
    }

    return () => {
      socket.close()
      wsRef.current = null
    }
  }, [runId]) // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = () => {
    wsRef.current?.send(JSON.stringify({ action: 'cancel' }))
  }

  return { cancel }
}
