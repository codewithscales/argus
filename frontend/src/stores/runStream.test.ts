import { describe, it, expect, beforeEach } from 'vitest'
import { useRunStreamStore } from './runStream'
import type { Span } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSpan(overrides: Partial<Span> & { span_id: string }): Span {
  return {
    id: 'db-id-1',
    run_id: 'run-abc',
    trace_id: 'trace-xyz',
    parent_span_id: null,
    name: 'test-span',
    kind: 'custom',
    start_time: '2024-01-01T00:00:00.000Z',
    end_time: null,
    status_code: 'UNSET',
    status_message: null,
    attributes: {},
    events: [],
    ...overrides,
  }
}

// Reset store state between tests so each test starts clean.
beforeEach(() => {
  useRunStreamStore.getState().reset()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRunStreamStore — initial state', () => {
  it('has empty spans map', () => {
    expect(useRunStreamStore.getState().spans).toEqual({})
  })

  it('has null runStatus', () => {
    expect(useRunStreamStore.getState().runStatus).toBeNull()
  })

  it('has null runOutput', () => {
    expect(useRunStreamStore.getState().runOutput).toBeNull()
  })

  it('is not connected', () => {
    expect(useRunStreamStore.getState().isConnected).toBe(false)
  })

  it('has no selected span', () => {
    expect(useRunStreamStore.getState().selectedSpanId).toBeNull()
  })
})

describe('addOrUpdateSpan', () => {
  it('adds a new span keyed by span_id', () => {
    const span = makeSpan({ span_id: 'span-001' })
    useRunStreamStore.getState().addOrUpdateSpan(span)

    const spans = useRunStreamStore.getState().spans
    expect(spans['span-001']).toBeDefined()
    expect(spans['span-001'].name).toBe('test-span')
  })

  it('merges a partial update into an existing span (e.g. end_time added)', () => {
    const span = makeSpan({ span_id: 'span-002' })
    useRunStreamStore.getState().addOrUpdateSpan(span)

    // Simulate span_end event: only span_id + end_time arrive
    useRunStreamStore.getState().addOrUpdateSpan({
      span_id: 'span-002',
      end_time: '2024-01-01T00:01:00.000Z',
    })

    const updated = useRunStreamStore.getState().spans['span-002']
    expect(updated.end_time).toBe('2024-01-01T00:01:00.000Z')
    // Original fields are preserved
    expect(updated.name).toBe('test-span')
  })

  it('stores multiple spans independently', () => {
    useRunStreamStore.getState().addOrUpdateSpan(makeSpan({ span_id: 'span-a', name: 'alpha' }))
    useRunStreamStore.getState().addOrUpdateSpan(makeSpan({ span_id: 'span-b', name: 'beta' }))

    const spans = useRunStreamStore.getState().spans
    expect(Object.keys(spans)).toHaveLength(2)
    expect(spans['span-a'].name).toBe('alpha')
    expect(spans['span-b'].name).toBe('beta')
  })
})

describe('setRunStatus', () => {
  it('updates runStatus', () => {
    useRunStreamStore.getState().setRunStatus('running')
    expect(useRunStreamStore.getState().runStatus).toBe('running')
  })

  it('can be updated multiple times', () => {
    useRunStreamStore.getState().setRunStatus('running')
    useRunStreamStore.getState().setRunStatus('completed')
    expect(useRunStreamStore.getState().runStatus).toBe('completed')
  })
})

describe('setRunOutput', () => {
  it('stores an output object', () => {
    const output = { result: 'done', score: 42 }
    useRunStreamStore.getState().setRunOutput(output)
    expect(useRunStreamStore.getState().runOutput).toEqual(output)
  })

  it('accepts null to clear output', () => {
    useRunStreamStore.getState().setRunOutput({ result: 'done' })
    useRunStreamStore.getState().setRunOutput(null)
    expect(useRunStreamStore.getState().runOutput).toBeNull()
  })
})

describe('selectSpan', () => {
  it('sets selectedSpanId', () => {
    useRunStreamStore.getState().selectSpan('span-123')
    expect(useRunStreamStore.getState().selectedSpanId).toBe('span-123')
  })

  it('null deselects the current span', () => {
    useRunStreamStore.getState().selectSpan('span-123')
    useRunStreamStore.getState().selectSpan(null)
    expect(useRunStreamStore.getState().selectedSpanId).toBeNull()
  })
})

describe('reset', () => {
  it('returns every field to its initial value', () => {
    // Dirty the store
    useRunStreamStore.getState().addOrUpdateSpan(makeSpan({ span_id: 'span-x' }))
    useRunStreamStore.getState().setRunStatus('running')
    useRunStreamStore.getState().setRunOutput({ result: 'ok' })
    useRunStreamStore.getState().setConnected(true)
    useRunStreamStore.getState().selectSpan('span-x')

    useRunStreamStore.getState().reset()

    const state = useRunStreamStore.getState()
    expect(state.spans).toEqual({})
    expect(state.runStatus).toBeNull()
    expect(state.runOutput).toBeNull()
    expect(state.isConnected).toBe(false)
    expect(state.selectedSpanId).toBeNull()
  })
})
