import { useState } from 'react'
import { agentsApi } from '@/api/agents'
import type { AgentAdapter } from '@/types'

interface Props {
  onCreated: () => void
  onCancel: () => void
}

const ADAPTER_DEFAULTS: Record<AgentAdapter, Record<string, unknown>> = {
  http:   { url: 'http://localhost:9000/invoke', timeout_s: 60 },
  python: { module: 'my_agent', callable: 'run' },
  claude: { model: 'claude-sonnet-4-6', max_tokens: 1024 },
}

export default function AgentForm({ onCreated, onCancel }: Props) {
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [adapter, setAdapter]     = useState<AgentAdapter>('http')
  const [configStr, setConfigStr] = useState(JSON.stringify(ADAPTER_DEFAULTS.http, null, 2))
  const [error, setError]         = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)

  const onAdapterChange = (a: AgentAdapter) => {
    setAdapter(a)
    setConfigStr(JSON.stringify(ADAPTER_DEFAULTS[a], null, 2))
  }

  const submit = async () => {
    setError(null)
    let config: Record<string, unknown>
    try { config = JSON.parse(configStr) } catch { setError('Config is not valid JSON'); return }

    setSaving(true)
    try {
      await agentsApi.create({ name, description: description || undefined, adapter, config })
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create agent')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-500'

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Name *</label>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="my-agent" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Description</label>
        <input className={inputCls} value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Optional" />
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Adapter</label>
        <select
          className={inputCls}
          value={adapter}
          onChange={(e) => onAdapterChange(e.target.value as AgentAdapter)}
        >
          <option value="http">HTTP endpoint</option>
          <option value="python">Python callable</option>
          <option value="claude">Claude (direct)</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-slate-400 mb-1">Config (JSON)</label>
        <textarea
          className={`${inputCls} font-mono text-[12px] leading-relaxed h-36 resize-none`}
          value={configStr}
          onChange={(e) => setConfigStr(e.target.value)}
          spellCheck={false}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">Cancel</button>
        <button
          onClick={submit}
          disabled={!name || saving}
          className="px-4 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Creating…' : 'Create'}
        </button>
      </div>
    </div>
  )
}
