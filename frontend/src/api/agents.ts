import { api } from './client'
import type { Agent, AgentCreate } from '@/types'

export const agentsApi = {
  list:   ()                              => api.get<Agent[]>('/agents'),
  get:    (id: string)                    => api.get<Agent>(`/agents/${id}`),
  create: (payload: AgentCreate)          => api.post<Agent>('/agents', payload),
  update: (id: string, patch: Partial<AgentCreate>) => api.put<Agent>(`/agents/${id}`, patch),
  delete: (id: string)                    => api.delete<void>(`/agents/${id}`),
}
