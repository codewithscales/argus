import type { Run, Span } from '@/types'

interface Props {
  run: Run | null
  spans: Span[]
  status: string
}

interface TokenResult {
  input: number
  output: number
  total: number
  model: string | null
}

// Walk an arbitrary response object looking for token counts and model name.
// Handles Anthropic, OpenAI, and common custom shapes — works without OTel.
export function extractTokensFromOutput(output: Record<string, unknown> | null): TokenResult {
  const result: TokenResult = { input: 0, output: 0, total: 0, model: null }
  if (!output) return result

  function num(v: unknown): number {
    if (typeof v === 'number') return v
    if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v)
    return 0
  }

  function walk(obj: unknown): void {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return
    const o = obj as Record<string, unknown>

    // Model name — pick the first string value at any level
    if (!result.model && typeof o['model'] === 'string') result.model = o['model']

    // Anthropic: { input_tokens, output_tokens }
    if (o['input_tokens'] != null || o['output_tokens'] != null) {
      result.input  += num(o['input_tokens'])
      result.output += num(o['output_tokens'])
    }
    // OpenAI: { prompt_tokens, completion_tokens, total_tokens }
    if (o['prompt_tokens'] != null || o['completion_tokens'] != null) {
      result.input  += num(o['prompt_tokens'])
      result.output += num(o['completion_tokens'])
      if (!result.total) result.total = num(o['total_tokens'])
    }

    // Recurse into nested objects (usage, data, result, choices, etc.)
    for (const val of Object.values(o)) {
      if (val && typeof val === 'object' && !Array.isArray(val)) walk(val)
    }
  }

  walk(output)
  if (!result.total) result.total = result.input + result.output
  return result
}

// $ per 1M tokens — prefix-matched against model name
const PRICING: Array<[string, { input: number; output: number }]> = [
  ['claude-opus-4',      { input: 15,   output: 75   }],
  ['claude-opus',        { input: 15,   output: 75   }],
  ['claude-sonnet-4',    { input: 3,    output: 15   }],
  ['claude-sonnet',      { input: 3,    output: 15   }],
  ['claude-haiku-4',     { input: 0.8,  output: 4    }],
  ['claude-haiku',       { input: 0.25, output: 1.25 }],
  ['gpt-4o',             { input: 5,    output: 15   }],
  ['gpt-4',              { input: 30,   output: 60   }],
  ['gpt-3.5',            { input: 0.5,  output: 1.5  }],
]

function getPrice(model: string) {
  const m = model.toLowerCase()
  for (const [prefix, price] of PRICING) {
    if (m.includes(prefix)) return price
  }
  return null
}

function numAttr(span: Span, ...keys: string[]): number {
  for (const k of keys) {
    const v = span.attributes[k]
    if (typeof v === 'number') return v
    if (typeof v === 'string' && !isNaN(Number(v))) return Number(v)
  }
  return 0
}

function fmtDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`
  if (ms >= 1_000)  return `${(ms / 1_000).toFixed(2)}s`
  return `${ms}ms`
}

function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  if (n >= 1024)        return `${(n / 1024).toFixed(1)} KB`
  return `${n} B`
}

function fmtCost(usd: number): string {
  if (usd < 0.0001) return '<$0.0001'
  if (usd < 0.01)   return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(3)}`
}

interface Metric {
  label: string
  value: string
  sub?: string
  muted?: boolean
}

function Cell({ label, value, sub, muted }: Metric) {
  return (
    <div className="flex flex-col items-center px-4 py-2 border-r border-slate-800 last:border-r-0 min-w-[90px]">
      <span className={`text-sm font-mono font-semibold ${muted ? 'text-slate-600' : 'text-slate-100'}`}>
        {value}
      </span>
      {sub && <span className="text-[10px] text-slate-600 font-mono mt-0.5">{sub}</span>}
      <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  )
}

export default function RunInsights({ run, spans, status }: Props) {
  const isRunning = status === 'running' || status === 'pending'

  // Latency
  const latency = run?.ended_at && run?.started_at
    ? fmtDuration(new Date(run.ended_at).getTime() - new Date(run.started_at).getTime())
    : isRunning ? '…' : '—'

  // Span breakdown
  const spanKinds = spans.reduce<Record<string, number>>((acc, s) => {
    acc[s.kind] = (acc[s.kind] ?? 0) + 1
    return acc
  }, {})
  const spanSub = Object.entries(spanKinds)
    .map(([k, n]) => `${n} ${k}`)
    .join(' · ')

  // Tokens — prefer run.output (works for all adapters), fall back to OTel span aggregation
  const fromOutput = extractTokensFromOutput(run?.output ?? null)

  const llmSpans = spans.filter((s) => s.kind === 'llm')
  const spanInput  = llmSpans.reduce((sum, s) => sum + numAttr(s, 'llm.input_tokens',  'gen_ai.usage.input_tokens'),  0)
  const spanOutput = llmSpans.reduce((sum, s) => sum + numAttr(s, 'llm.output_tokens', 'gen_ai.usage.output_tokens'), 0)
  const spanTotal  = spanInput + spanOutput || llmSpans.reduce((sum, s) => sum + numAttr(s, 'llm.total_tokens'), 0)

  const inputTokens  = fromOutput.input  || spanInput
  const outputTokens = fromOutput.output || spanOutput
  const totalTokens  = fromOutput.total  || spanTotal

  // Model — prefer output, fall back to span attributes
  const spanModel = llmSpans
    .map((s) => s.attributes['llm.model'] ?? s.attributes['gen_ai.request.model'])
    .find((m) => typeof m === 'string') as string | undefined
  const model = fromOutput.model ?? spanModel ?? null

  // Cost
  let estimatedCost: string | null = null
  if (totalTokens > 0 && model) {
    const price = getPrice(model)
    if (price && inputTokens > 0 && outputTokens > 0) {
      const cost = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output
      estimatedCost = fmtCost(cost)
    }
  }

  // Output size
  const outputSize = run?.output
    ? fmtBytes(new Blob([JSON.stringify(run.output)]).size)
    : null

  const metrics: Metric[] = [
    {
      label: 'Latency',
      value: latency,
      muted: latency === '—',
    },
    {
      label: 'Spans',
      value: spans.length > 0 ? String(spans.length) : '—',
      sub: spanSub || undefined,
      muted: spans.length === 0,
    },
    {
      label: 'Tokens',
      value: totalTokens > 0 ? fmtTokens(totalTokens) : '—',
      sub: totalTokens > 0 ? `${fmtTokens(inputTokens)} in · ${fmtTokens(outputTokens)} out` : undefined,
      muted: totalTokens === 0,
    },
    {
      label: 'Est. Cost',
      value: estimatedCost ?? '—',
      muted: !estimatedCost,
    },
    {
      label: 'Output size',
      value: outputSize ?? '—',
      muted: !outputSize,
    },
  ]

  return (
    <div className="shrink-0 border-b border-slate-800 bg-slate-900/60 flex items-stretch overflow-x-auto">
      {metrics.map((m) => (
        <Cell key={m.label} {...m} />
      ))}
    </div>
  )
}
