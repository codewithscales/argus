import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RunInsights, { extractTokensFromOutput } from './RunInsights'
import type { Run, Span } from '@/types'

const baseRun: Run = {
  id: 'run-1',
  agent_id: 'agent-1',
  status: 'completed',
  input: { message: 'hello' },
  output: { reply: 'world' },
  started_at: '2024-01-01T00:00:00.000Z',
  ended_at:   '2024-01-01T00:00:01.500Z',
  metadata: {},
}

function makeSpan(overrides: Partial<Span> = {}): Span {
  return {
    id: 'db-1', run_id: 'run-1', span_id: 'sp-1', trace_id: 'tr-1',
    parent_span_id: null, name: 'llm-call', kind: 'llm',
    start_time: '2024-01-01T00:00:00Z', end_time: '2024-01-01T00:00:01Z',
    status_code: 'OK', status_message: null,
    attributes: {}, events: [],
    ...overrides,
  }
}

describe('extractTokensFromOutput', () => {
  it('returns zeros for null', () => {
    const r = extractTokensFromOutput(null)
    expect(r).toMatchObject({ input: 0, output: 0, total: 0, model: null })
  })

  it('reads Anthropic-style usage — { usage: { input_tokens, output_tokens } }', () => {
    const r = extractTokensFromOutput({ usage: { input_tokens: 100, output_tokens: 50 } })
    expect(r.input).toBe(100)
    expect(r.output).toBe(50)
    expect(r.total).toBe(150)
  })

  it('reads OpenAI-style usage — { usage: { prompt_tokens, completion_tokens, total_tokens } }', () => {
    const r = extractTokensFromOutput({ usage: { prompt_tokens: 200, completion_tokens: 80, total_tokens: 280 } })
    expect(r.input).toBe(200)
    expect(r.output).toBe(80)
    expect(r.total).toBe(280)
  })

  it('reads top-level token fields', () => {
    const r = extractTokensFromOutput({ input_tokens: 30, output_tokens: 10 })
    expect(r.input).toBe(30)
    expect(r.output).toBe(10)
  })

  it('extracts model name from any depth', () => {
    const r = extractTokensFromOutput({ data: { model: 'claude-haiku', usage: { input_tokens: 5, output_tokens: 5 } } })
    expect(r.model).toBe('claude-haiku')
  })

  it('handles ClaudeAdapter output shape exactly', () => {
    const r = extractTokensFromOutput({
      response: 'hello world',
      usage: { input_tokens: 42, output_tokens: 18 },
    })
    expect(r.input).toBe(42)
    expect(r.output).toBe(18)
    expect(r.total).toBe(60)
  })

  it('returns zeros for output with no token fields', () => {
    const r = extractTokensFromOutput({ reply: 'ok', status: 'done' })
    expect(r.input).toBe(0)
    expect(r.output).toBe(0)
  })
})

describe('RunInsights', () => {
  it('shows latency from run start/end times', () => {
    render(<RunInsights run={baseRun} spans={[]} status="completed" />)
    expect(screen.getByText('1.50s')).toBeInTheDocument()
  })

  it('shows — for latency when run has no ended_at', () => {
    render(<RunInsights run={{ ...baseRun, ended_at: null }} spans={[]} status="running" />)
    expect(screen.getByText('…')).toBeInTheDocument()
  })

  it('shows span count and kind breakdown', () => {
    const spans = [
      makeSpan({ span_id: 'sp-1', kind: 'llm' }),
      makeSpan({ span_id: 'sp-2', kind: 'tool' }),
    ]
    render(<RunInsights run={baseRun} spans={spans} status="completed" />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/1 llm/)).toBeInTheDocument()
  })

  it('aggregates tokens from llm spans', () => {
    const span = makeSpan({
      attributes: { 'llm.input_tokens': 800, 'llm.output_tokens': 200 },
    })
    render(<RunInsights run={baseRun} spans={[span]} status="completed" />)
    expect(screen.getByText('1.0k')).toBeInTheDocument()
    expect(screen.getByText(/800.*in/)).toBeInTheDocument()
  })

  it('shows estimated cost when model is known', () => {
    const span = makeSpan({
      attributes: {
        'llm.model': 'claude-haiku',
        'llm.input_tokens': 1_000_000,
        'llm.output_tokens': 1_000_000,
      },
    })
    render(<RunInsights run={baseRun} spans={[span]} status="completed" />)
    // haiku: $0.25/1M in + $1.25/1M out = $1.50
    expect(screen.getByText('$1.500')).toBeInTheDocument()
  })

  it('shows — for cost when model is unknown', () => {
    const span = makeSpan({
      attributes: { 'llm.input_tokens': 500, 'llm.output_tokens': 500 },
    })
    render(<RunInsights run={baseRun} spans={[span]} status="completed" />)
    // no model attr → no price
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('shows output size when run has output', () => {
    render(<RunInsights run={baseRun} spans={[]} status="completed" />)
    expect(screen.getByText(/B$/)).toBeInTheDocument()
  })

  it('shows tokens from run.output without any spans', () => {
    const run = { ...baseRun, output: { response: 'hi', usage: { input_tokens: 50, output_tokens: 20 } } }
    render(<RunInsights run={run} spans={[]} status="completed" />)
    expect(screen.getByText('70')).toBeInTheDocument()
    expect(screen.getByText(/50.*in/)).toBeInTheDocument()
  })

  it('shows cost when model is in run.output', () => {
    const run = {
      ...baseRun,
      output: { model: 'claude-haiku', usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 } },
    }
    render(<RunInsights run={run} spans={[]} status="completed" />)
    expect(screen.getByText('$1.500')).toBeInTheDocument()
  })

  it('shows — for output size when run has no output', () => {
    render(<RunInsights run={{ ...baseRun, output: null }} spans={[]} status="completed" />)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('supports gen_ai token attributes', () => {
    const span = makeSpan({
      attributes: {
        'gen_ai.usage.input_tokens': 300,
        'gen_ai.usage.output_tokens': 100,
      },
    })
    render(<RunInsights run={baseRun} spans={[span]} status="completed" />)
    expect(screen.getByText('400')).toBeInTheDocument()
  })
})
