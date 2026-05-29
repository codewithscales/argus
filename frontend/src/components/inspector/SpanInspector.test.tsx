import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SpanInspector from './SpanInspector'
import type { Span } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpan(overrides: Partial<Span> = {}): Span {
  return {
    id: 'db-id-1',
    run_id: 'run-abc',
    span_id: 'span-001',
    trace_id: 'trace-xyz',
    parent_span_id: null,
    name: 'my-test-span',
    kind: 'custom',
    start_time: '2024-03-15T10:00:00.000Z',
    end_time: '2024-03-15T10:00:01.500Z',
    status_code: 'UNSET',
    status_message: null,
    attributes: {},
    events: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SpanInspector', () => {
  describe('null span (empty state)', () => {
    it('renders the empty-state prompt when span is null', () => {
      render(<SpanInspector span={null} />)
      expect(screen.getByText('Select a node to inspect')).toBeInTheDocument()
    })

    it('does not render any span data when span is null', () => {
      render(<SpanInspector span={null} />)
      expect(screen.queryByText(/timing/i)).not.toBeInTheDocument()
    })
  })

  describe('span header', () => {
    it('renders the span name', () => {
      render(<SpanInspector span={makeSpan({ name: 'call-llm' })} />)
      expect(screen.getByText('call-llm')).toBeInTheDocument()
    })

    it('renders the span kind badge', () => {
      render(<SpanInspector span={makeSpan({ kind: 'tool' })} />)
      // kind badge is uppercased via CSS class, but the text content stays lowercase
      expect(screen.getByText('tool')).toBeInTheDocument()
    })
  })

  describe('events guard — regression for undefined events', () => {
    it('does not crash when span.events is undefined', () => {
      // Cast to simulate a span arriving before the fix (missing events field)
      const spanWithoutEvents = makeSpan() as Span & { events: undefined }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(spanWithoutEvents as any).events = undefined

      expect(() => render(<SpanInspector span={spanWithoutEvents} />)).not.toThrow()
    })

    it('does not render an Events section when events list is empty', () => {
      render(<SpanInspector span={makeSpan({ events: [] })} />)
      expect(screen.queryByText(/events/i)).not.toBeInTheDocument()
    })

    it('renders Events section when span has events', () => {
      const span = makeSpan({
        events: [{ name: 'tool_call', timestamp: '2024-03-15T10:00:00.500Z' }],
      })
      render(<SpanInspector span={span} />)
      expect(screen.getByText(/events/i)).toBeInTheDocument()
    })
  })

  describe('token section — LLM spans only', () => {
    it('shows Tokens section when llm.input_tokens attribute is present', () => {
      const span = makeSpan({
        kind: 'llm',
        attributes: { 'llm.input_tokens': 128, 'llm.output_tokens': 64 },
      })
      render(<SpanInspector span={span} />)
      expect(screen.getByText(/tokens/i)).toBeInTheDocument()
      expect(screen.getByText('128')).toBeInTheDocument()
      expect(screen.getByText('64')).toBeInTheDocument()
    })

    it('does NOT show Tokens section when llm token attributes are absent', () => {
      const span = makeSpan({ kind: 'custom', attributes: {} })
      render(<SpanInspector span={span} />)
      expect(screen.queryByText(/^tokens$/i)).not.toBeInTheDocument()
    })

    it('shows the model name when llm.model attribute is present', () => {
      const span = makeSpan({
        kind: 'llm',
        attributes: { 'llm.input_tokens': 10, 'llm.model': 'gpt-test-v1' },
      })
      render(<SpanInspector span={span} />)
      expect(screen.getByText('gpt-test-v1')).toBeInTheDocument()
    })
  })

  describe('status colours', () => {
    it('shows ERROR status code text', () => {
      const span = makeSpan({ status_code: 'ERROR', status_message: 'Something went wrong' })
      render(<SpanInspector span={span} />)
      const errorEl = screen.getByText('ERROR')
      // The component applies text-red-400 for ERROR status
      expect(errorEl).toHaveClass('text-red-400')
    })

    it('shows OK status code text', () => {
      const span = makeSpan({ status_code: 'OK' })
      render(<SpanInspector span={span} />)
      const okEl = screen.getByText('OK')
      // The component applies text-green-400 for OK status
      expect(okEl).toHaveClass('text-green-400')
    })
  })

  describe('timing section', () => {
    it('shows duration in milliseconds for a sub-second span', () => {
      const span = makeSpan({
        start_time: '2024-03-15T10:00:00.000Z',
        end_time: '2024-03-15T10:00:00.250Z',
      })
      render(<SpanInspector span={span} />)
      expect(screen.getByText('250ms')).toBeInTheDocument()
    })

    it('shows "running…" duration when end_time is null', () => {
      const span = makeSpan({ end_time: null })
      render(<SpanInspector span={span} />)
      expect(screen.getByText('running…')).toBeInTheDocument()
    })
  })

  describe('status message', () => {
    it('renders status_message when present', () => {
      const span = makeSpan({ status_code: 'ERROR', status_message: 'Timeout exceeded' })
      render(<SpanInspector span={span} />)
      expect(screen.getByText('Timeout exceeded')).toBeInTheDocument()
    })

    it('does not render a status message row when status_message is null', () => {
      const span = makeSpan({ status_message: null })
      render(<SpanInspector span={span} />)
      expect(screen.queryByText('Timeout exceeded')).not.toBeInTheDocument()
    })
  })
})
