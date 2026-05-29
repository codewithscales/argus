import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { runsApi } from '@/api/runs'
import { useAgents } from '@/hooks/useAgents'
import RunForm from '@/components/runs/RunForm'
import type { Run, RunStatus } from '@/types'

const STATUS_STYLES: Record<RunStatus, string> = {
  pending:   'bg-slate-700 text-slate-400',
  running:   'bg-blue-900/60 text-blue-300 animate-pulse',
  completed: 'bg-green-900/50 text-green-300',
  failed:    'bg-red-900/50 text-red-300',
  cancelled: 'bg-slate-700 text-slate-500',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
}

function dur(run: Run) {
  if (!run.ended_at) return run.status === 'running' ? 'running…' : '—'
  const ms = new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

export default function RunsPage() {
  const navigate = useNavigate()
  const { agents } = useAgents()
  const [runs, setRuns]           = useState<Run[]>([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [actioningId, setActioning] = useState<string | null>(null)

  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a.name]))

  const load = useCallback(async () => {
    setLoading(true)
    try { setRuns(await runsApi.list({ limit: 100 })) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleReRun = async (e: React.MouseEvent, run: Run) => {
    e.preventDefault()
    setActioning(run.id)
    try {
      const newRun = await runsApi.reRun(run)
      navigate(`/runs/${newRun.id}`)
    } catch (err) {
      console.error(err)
    } finally {
      setActioning(null)
    }
  }

  const handleDelete = async (e: React.MouseEvent, run: Run) => {
    e.preventDefault()
    setActioning(run.id)
    try {
      await runsApi.delete(run.id)
      setRuns((prev) => prev.filter((r) => r.id !== run.id))
    } catch (err) {
      console.error(err)
    } finally {
      setActioning(null)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-100">Runs</h1>
          <p className="text-xs text-slate-500 mt-0.5">{runs.length} total</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md"
        >
          ▶ New run
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {showForm && (
          <div className="mb-6 bg-slate-800 border border-slate-700 rounded-lg p-5">
            <h2 className="text-sm font-medium text-slate-200 mb-4">Start run</h2>
            <RunForm agents={agents} onCancel={() => setShowForm(false)} />
          </div>
        )}

        {loading && <p className="text-sm text-slate-500">Loading…</p>}

        {!loading && runs.length === 0 && !showForm && (
          <div className="text-center py-16 text-slate-600">
            <p className="text-4xl mb-3">▶</p>
            <p className="text-sm">No runs yet. Start one above.</p>
          </div>
        )}

        <div className="space-y-1.5">
          {runs.map((run) => {
            const busy = actioningId === run.id
            return (
              <Link
                key={run.id}
                to={`/runs/${run.id}`}
                className="flex items-center gap-4 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 rounded-lg px-4 py-3 transition-colors group"
              >
                <span className={clsx('shrink-0 text-[10px] font-mono px-2 py-0.5 rounded-full uppercase', STATUS_STYLES[run.status])}>
                  {run.status}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200 truncate">
                    {agentMap[run.agent_id] ?? run.agent_id}
                  </p>
                  <p className="text-xs text-slate-600 font-mono truncate">
                    {JSON.stringify(run.input).slice(0, 60)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-500">{fmt(run.started_at)}</p>
                  <p className="text-xs text-slate-600 font-mono">{dur(run)}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleReRun(e, run)}
                    disabled={busy}
                    title="Re-run with same input"
                    className="px-2 py-1 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700 rounded disabled:opacity-40"
                  >
                    {busy ? '…' : '↺'}
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, run)}
                    disabled={busy}
                    title="Delete run"
                    className="px-2 py-1 text-xs text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded disabled:opacity-40"
                  >
                    ✕
                  </button>
                </div>
                <span className="shrink-0 text-slate-600 group-hover:text-slate-400 text-xs">→</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
