import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import clsx from 'clsx'
import type { SpanKind, SpanStatusCode } from '@/types'
import type { SpanNodeData } from './layout'

export type SpanNodeType = Node<SpanNodeData, 'spanNode'>

const KIND_STYLES: Record<SpanKind, { border: string; badge: string; label: string }> = {
  llm:       { border: 'border-blue-500',   badge: 'bg-blue-500/20 text-blue-300',   label: 'LLM'       },
  tool:      { border: 'border-green-500',  badge: 'bg-green-500/20 text-green-300', label: 'Tool'      },
  agent:     { border: 'border-purple-500', badge: 'bg-purple-500/20 text-purple-300',label: 'Agent'    },
  retrieval: { border: 'border-amber-500',  badge: 'bg-amber-500/20 text-amber-300', label: 'Retrieval' },
  custom:    { border: 'border-slate-500',  badge: 'bg-slate-500/20 text-slate-400', label: 'Custom'    },
}

const STATUS_DOT: Record<SpanStatusCode, string> = {
  OK:    'bg-green-400',
  ERROR: 'bg-red-400',
  UNSET: 'bg-slate-500',
}

function duration(start: string, end: string | null): string {
  if (!end) return '…'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`
}

export function SpanNode({ data, selected }: NodeProps<SpanNodeType>) {
  const { span } = data
  const kind = KIND_STYLES[span.kind] ?? KIND_STYLES.custom
  const isRunning = span.end_time === null || span.end_time === undefined

  return (
    <div
      className={clsx(
        'w-[228px] h-[72px] rounded-lg border-l-[3px] border border-slate-700 bg-slate-800 px-3 py-2',
        'flex flex-col justify-between cursor-pointer select-none',
        'transition-all duration-150',
        kind.border,
        selected && 'ring-1 ring-slate-400 bg-slate-750',
        isRunning && 'animate-pulse',
      )}
    >
      <Handle type="target" position={Position.Top}    className="!bg-slate-600 !border-slate-500 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-600 !border-slate-500 !w-2 !h-2" />

      <div className="flex items-center gap-1.5 min-w-0">
        <span className={clsx('shrink-0 w-2 h-2 rounded-full', STATUS_DOT[span.status_code])} />
        <span className="text-sm text-slate-100 font-medium truncate">{span.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className={clsx('text-[10px] font-mono px-1.5 py-0.5 rounded', kind.badge)}>
          {kind.label}
        </span>
        <span className="text-[11px] text-slate-500 font-mono">
          {duration(span.start_time, span.end_time)}
        </span>
      </div>
    </div>
  )
}
