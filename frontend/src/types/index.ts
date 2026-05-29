export type AgentAdapter = 'http' | 'python' | 'claude'

export interface Agent {
  id: string
  name: string
  description: string | null
  adapter: AgentAdapter
  config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AgentCreate {
  name: string
  description?: string
  adapter: AgentAdapter
  config: Record<string, unknown>
}

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Run {
  id: string
  agent_id: string
  status: RunStatus
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  started_at: string
  ended_at: string | null
  metadata: Record<string, unknown>
}

export interface RunCreate {
  agent_id: string
  input: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type SpanKind = 'llm' | 'tool' | 'agent' | 'retrieval' | 'custom'
export type SpanStatusCode = 'UNSET' | 'OK' | 'ERROR'

export interface Span {
  id: string
  run_id: string
  span_id: string
  trace_id: string
  parent_span_id: string | null
  name: string
  kind: SpanKind
  start_time: string
  end_time: string | null
  status_code: SpanStatusCode
  status_message: string | null
  attributes: Record<string, unknown>
  events: Array<Record<string, unknown>>
}

export interface Evaluation {
  id: string
  run_id: string
  score: number | null
  label: 'pass' | 'fail' | 'partial' | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EvalCreate {
  score?: number | null
  label?: 'pass' | 'fail' | 'partial' | null
  notes?: string | null
}

// WebSocket event union
export type WsEvent =
  | { event: 'connected'; run_id: string }
  | { event: 'span_start'; span: Partial<Span> & { span_id: string } }
  | { event: 'span_end';   span: Partial<Span> & { span_id: string } }
  | { event: 'run_start';  run: { run_id: string; status: string } }
  | { event: 'run_end';    run: { run_id: string; status: string; output?: Record<string, unknown> } }
  | { event: 'error';      error: { message: string } }
