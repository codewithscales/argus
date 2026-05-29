import { useState, useEffect, useCallback } from 'react'
import { agentsApi } from '@/api/agents'
import type { Agent } from '@/types'

export function useAgents() {
  const [agents, setAgents]   = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setAgents(await agentsApi.list())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetch() }, [fetch])

  return { agents, loading, error, refetch: fetch }
}
