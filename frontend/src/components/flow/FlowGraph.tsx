import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { Span } from '@/types'
import { buildFlowLayout } from './layout'
import { SpanNode, type SpanNodeType } from './SpanNode'

const nodeTypes: NodeTypes = { spanNode: SpanNode }

interface Props {
  spans: Span[]
  selectedSpanId: string | null
  onSelectSpan: (spanId: string | null) => void
}

export default function FlowGraph({ spans, selectedSpanId, onSelectSpan }: Props) {
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildFlowLayout(spans),
    [spans],
  )

  const nodesWithSelection = useMemo(
    () => layoutNodes.map((n) => ({ ...n, type: 'spanNode' as const, selected: n.id === selectedSpanId })),
    [layoutNodes, selectedSpanId],
  )

  const [, , onNodesChange] = useNodesState<SpanNodeType>(nodesWithSelection)
  const [edges, , onEdgesChange] = useEdgesState(layoutEdges)

  const onNodeClick: NodeMouseHandler<SpanNodeType> = useCallback(
    (_, node) => onSelectSpan(node.id === selectedSpanId ? null : node.id),
    [selectedSpanId, onSelectSpan],
  )

  const onPaneClick = useCallback(() => onSelectSpan(null), [onSelectSpan])

  if (spans.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Waiting for spans…
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodesWithSelection}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={(n) => {
          const span = (n.data as { span: Span }).span
          const colors: Record<string, string> = {
            llm: '#3b82f6', tool: '#22c55e', agent: '#a855f7',
            retrieval: '#f59e0b', custom: '#64748b',
          }
          return colors[span.kind] ?? '#64748b'
        }}
        maskColor="rgba(15,23,42,0.6)"
      />
    </ReactFlow>
  )
}
