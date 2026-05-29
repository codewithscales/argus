import { useState } from 'react'
import { agentsApi } from '@/api/agents'
import { useAgents } from '@/hooks/useAgents'
import AgentForm from '@/components/agents/AgentForm'

const ADAPTER_BADGE: Record<string, string> = {
  http:   'bg-sky-900/50 text-sky-300',
  python: 'bg-violet-900/50 text-violet-300',
  claude: 'bg-orange-900/50 text-orange-300',
}

export default function AgentsPage() {
  const { agents, loading, error, refetch } = useAgents()
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this agent?')) return
    setDeleting(id)
    try { await agentsApi.delete(id); await refetch() }
    finally { setDeleting(null) }
  }

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-100">Agents</h1>
          <p className="text-xs text-slate-500 mt-0.5">Registered agent adapters</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-md"
        >
          + New agent
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {/* New agent form */}
        {showForm && (
          <div className="mb-6 bg-slate-800 border border-slate-700 rounded-lg p-5">
            <h2 className="text-sm font-medium text-slate-200 mb-4">Register agent</h2>
            <AgentForm
              onCreated={() => { setShowForm(false); void refetch() }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error   && <p className="text-sm text-red-400">{error}</p>}

        {!loading && agents.length === 0 && !showForm && (
          <div className="text-center py-16 text-slate-600">
            <p className="text-4xl mb-3">⬡</p>
            <p className="text-sm">No agents yet. Register one to start.</p>
          </div>
        )}

        <div className="space-y-2">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-100">{agent.name}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase ${ADAPTER_BADGE[agent.adapter] ?? 'bg-slate-700 text-slate-400'}`}>
                    {agent.adapter}
                  </span>
                </div>
                {agent.description && (
                  <p className="text-xs text-slate-500">{agent.description}</p>
                )}
                <p className="text-[11px] font-mono text-slate-600 mt-1 truncate">
                  {JSON.stringify(agent.config).slice(0, 80)}…
                </p>
              </div>
              <button
                onClick={() => void handleDelete(agent.id)}
                disabled={deleting === agent.id}
                className="shrink-0 text-xs text-slate-600 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                {deleting === agent.id ? '…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
