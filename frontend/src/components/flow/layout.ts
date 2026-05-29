import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'
import type { Span } from '@/types'

export type SpanNodeData = { span: Span }

const NODE_W = 228
const NODE_H = 72

export function buildFlowLayout(spans: Span[]): { nodes: Node<SpanNodeData>[]; edges: Edge[] } {
  if (spans.length === 0) return { nodes: [], edges: [] }

  const spanIds = new Set(spans.map((s) => s.span_id))

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', ranksep: 56, nodesep: 32, marginx: 32, marginy: 32 })
  g.setDefaultEdgeLabel(() => ({}))

  spans.forEach((s) => g.setNode(s.span_id, { width: NODE_W, height: NODE_H }))
  spans.forEach((s) => {
    if (s.parent_span_id && spanIds.has(s.parent_span_id)) {
      g.setEdge(s.parent_span_id, s.span_id)
    }
  })

  dagre.layout(g)

  const nodes: Node<SpanNodeData>[] = spans.map((span) => {
    const { x, y } = g.node(span.span_id)
    return {
      id: span.span_id,
      type: 'spanNode' as const,
      position: { x: x - NODE_W / 2, y: y - NODE_H / 2 },
      data: { span },
    }
  })

  const edges: Edge[] = spans
    .filter((s) => s.parent_span_id && spanIds.has(s.parent_span_id))
    .map((s) => ({
      id: `e-${s.parent_span_id}-${s.span_id}`,
      source: s.parent_span_id!,
      target: s.span_id,
      type: 'smoothstep',
    }))

  return { nodes, edges }
}
