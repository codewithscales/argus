import { api } from './client'
import type { EvalCreate, Evaluation, Run, RunCreate, Span } from '@/types'

export const runsApi = {
  list:      (params?: { agent_id?: string; status?: string; limit?: number }) => {
    const qs = new URLSearchParams()
    if (params?.agent_id) qs.set('agent_id', params.agent_id)
    if (params?.status)   qs.set('status',   params.status)
    if (params?.limit)    qs.set('limit',     String(params.limit))
    const query = qs.toString()
    return api.get<Run[]>(`/runs${query ? `?${query}` : ''}`)
  },
  get:       (id: string)                    => api.get<Run>(`/runs/${id}`),
  start:     (payload: RunCreate)            => api.post<Run>('/runs', payload),
  cancel:    (id: string)                    => api.post<Run>(`/runs/${id}/cancel`, {}),
  reRun:     (run: Run)                      => api.post<Run>('/runs', { agent_id: run.agent_id, input: run.input, metadata: run.metadata }),
  delete:    (id: string)                    => api.delete<void>(`/runs/${id}`),
  spans:     (id: string)                    => api.get<Span[]>(`/runs/${id}/spans`),
  getEval:   (id: string)                    => api.get<Evaluation | null>(`/runs/${id}/eval`),
  upsertEval:(id: string, payload: EvalCreate) => api.put<Evaluation>(`/runs/${id}/eval`, payload),
}
