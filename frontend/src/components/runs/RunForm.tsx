import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { runsApi } from '@/api/runs'
import type { Agent } from '@/types'

interface Props {
  agents: Agent[]
  onCancel: () => void
}

export default function RunForm({ agents, onCancel }: Props) {
  const navigate = useNavigate()
  const [agentId, setAgentId]     = useState(agents[0]?.id ?? '')
  const [inputStr, setInputStr]   = useState('{\n  "message": "Hello"\n}')
  const [error, setError]         = useState<string | null>(null)
  const [starting, setStarting]   = useState(false)

  const submit = async () => {
    setError(null)
    let input: Record<string, unknown>
    try { input = JSON.parse(inputStr) } catch { setError('Input is not valid JSON'); return }

    setStarting(true)
    try {
      const run = await runsApi.start({ agent_id: agentId, input })
      navigate(`/runs/${run.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start run')
      setStarting(false)
    }
  }

  const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-500'

  if (agents.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500 text-sm">
        No agents registered yet. Create one first.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Agent</label>
        <select className={inputCls} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Input (JSON)</label>
        <textarea
          className={`${inputCls} font-mono text-[12px] leading-relaxed h-36 resize-none`}
          value={inputStr}
          onChange={(e) => setInputStr(e.target.value)}
          spellCheck={false}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
        <button
          onClick={submit}
          disabled={starting}
          className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {starting ? 'Starting…' : '▶ Run'}
        </button>
      </div>
    </div>
  )
}
