import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import clsx from 'clsx'
import { runsApi } from '@/api/runs'
import { useRunStream } from '@/hooks/useRunStream'
import { useRunStreamStore } from '@/stores/runStream'
import FlowGraph from '@/components/flow/FlowGraph'
import SpanInspector from '@/components/inspector/SpanInspector'
import ResponsePanel from '@/components/inspector/ResponsePanel'
import RunInsights from '@/components/insights/RunInsights'
import type { Run, Span } from '@/types'

const STATUS_DOT: Record<string, string> = {
  pending:   'bg-slate-500',
  running:   'bg-blue-400 animate-pulse',
  completed: 'bg-green-400',
  failed:    'bg-red-400',
  cancelled: 'bg-slate-600',
}

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>()
  const [run, setRun] = useState<Run | null>(null)

  const { spans: spansMap, selectedSpanId, runStatus, runOutput, isConnected, selectSpan } =
    useRunStreamStore()
  const { cancel } = useRunStream(runId)

  useEffect(() => {
    if (!runId) return
    runsApi.get(runId).then(setRun).catch(console.error)
  }, [runId])

  const spans = Object.values(spansMap) as Span[]
  const selectedSpan = selectedSpanId ? spansMap[selectedSpanId] ?? null : null
  const displayStatus = runStatus ?? run?.status ?? 'pending'

  return (
    <div className="h-full flex flex-col">
      {/* Run info bar */}
      <header className="shrink-0 px-4 py-2.5 border-b border-slate-800 flex items-center gap-3 bg-slate-900">
        <Link to="/runs" className="text-slate-500 hover:text-slate-300 text-sm">← Runs</Link>
        <span className="text-slate-700">|</span>
        <span className={clsx('w-2 h-2 rounded-full shrink-0', STATUS_DOT[displayStatus])} />
        <span className="text-sm font-mono text-slate-300 truncate">{run?.id ?? runId}</span>
        <span className="text-xs text-slate-600">
          {spans.length} span{spans.length !== 1 ? 's' : ''}
        </span>
        {!isConnected && displayStatus === 'running' && (
          <span className="text-xs text-yellow-500">reconnecting…</span>
        )}
        <div className="flex-1" />
        {run?.started_at && (
          <span className="text-xs text-slate-600">
            {new Date(run.started_at).toLocaleTimeString()}
          </span>
        )}
        {displayStatus === 'running' && (
          <button
            onClick={cancel}
            className="px-2.5 py-1 text-xs text-red-400 border border-red-800 rounded hover:bg-red-900/30"
          >
            Cancel
          </button>
        )}
      </header>

      {/* Insights strip */}
      <RunInsights run={run} spans={spans} status={displayStatus} />

      {/* Main split: flow graph + inspector */}
      <div className="flex-1 flex min-h-0">
        {/* Flow graph */}
        <div className="flex-1 min-w-0 relative">
          <FlowGraph
            spans={spans}
            selectedSpanId={selectedSpanId}
            onSelectSpan={selectSpan}
          />
          {spans.length === 0 && displayStatus === 'pending' && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm pointer-events-none">
              Waiting for run to start…
            </div>
          )}
        </div>

        {/* Inspector panel — span details when a node is selected, response otherwise */}
        <aside className="w-80 shrink-0 border-l border-slate-800 bg-slate-900">
          {selectedSpan ? (
            <SpanInspector span={selectedSpan} />
          ) : (
            <ResponsePanel
              input={run?.input ?? {}}
              output={runOutput ?? run?.output ?? null}
              status={displayStatus}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
