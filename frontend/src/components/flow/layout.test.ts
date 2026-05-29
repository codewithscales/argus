import { describe, it, expect } from 'vitest'
import { buildFlowLayout } from './layout'
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildFlowLayout', () => {
  it('returns empty nodes and edges for an empty span list', () => {
    const { nodes, edges } = buildFlowLayout([])
    expect(nodes).toHaveLength(0)
    expect(edges).toHaveLength(0)
  })

  it('produces one node and no edges for a single root span', () => {
    const span = makeSpan({ span_id: 'span-root' })
    const { nodes, edges } = buildFlowLayout([span])

    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })

  it('produces two nodes and one edge for a parent-child pair', () => {
    const parent = makeSpan({ span_id: 'span-parent' })
    const child = makeSpan({ span_id: 'span-child', parent_span_id: 'span-parent' })

    const { nodes, edges } = buildFlowLayout([parent, child])

    expect(nodes).toHaveLength(2)
    expect(edges).toHaveLength(1)

    const edge = edges[0]
    expect(edge.source).toBe('span-parent')
    expect(edge.target).toBe('span-child')
  })

  it('does not create an edge when parent_span_id is not in the span set (orphan)', () => {
    const orphan = makeSpan({ span_id: 'span-orphan', parent_span_id: 'span-missing' })

    const { nodes, edges } = buildFlowLayout([orphan])

    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })

  it('node id equals span.span_id', () => {
    const span = makeSpan({ span_id: 'unique-span-id-42' })
    const { nodes } = buildFlowLayout([span])

    expect(nodes[0].id).toBe('unique-span-id-42')
  })

  it('node data contains the original span object', () => {
    const span = makeSpan({ span_id: 'span-data-check', name: 'my-llm-call', kind: 'llm' })
    const { nodes } = buildFlowLayout([span])

    expect(nodes[0].data.span).toEqual(span)
  })

  it('handles a chain of three spans with two edges', () => {
    const root = makeSpan({ span_id: 'root' })
    const mid = makeSpan({ span_id: 'mid', parent_span_id: 'root' })
    const leaf = makeSpan({ span_id: 'leaf', parent_span_id: 'mid' })

    const { nodes, edges } = buildFlowLayout([root, mid, leaf])

    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(2)

    const sources = edges.map((e) => e.source)
    const targets = edges.map((e) => e.target)
    expect(sources).toContain('root')
    expect(targets).toContain('mid')
    expect(sources).toContain('mid')
    expect(targets).toContain('leaf')
  })
})
