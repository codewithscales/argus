import clsx from 'clsx'
import type { Span } from '@/types'

interface Props {
  span: Span | null
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 border-b border-slate-800">
        {title}
      </div>
      <div className="px-4 py-3 space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-200 font-mono text-right break-all">{value}</span>
    </div>
  )
}

function duration(start: string, end: string | null): string {
  if (!end) return 'running…'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return ms >= 1000 ? `${(ms / 1000).toFixed(3)}s` : `${ms}ms`
}

function fmt(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 23)
}

export default function SpanInspector({ span }: Props) {
  if (!span) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm gap-1.5">
        <span className="text-2xl">◎</span>
        <span>Select a node to inspect</span>
      </div>
    )
  }

  const tokens = {
    input:  span.attributes['llm.input_tokens']  as number | undefined,
    output: span.attributes['llm.output_tokens'] as number | undefined,
    total:  span.attributes['llm.total_tokens']  as number | undefined,
  }
  const hasTokens = tokens.input != null || tokens.output != null

  const statusColor = { OK: 'text-green-400', ERROR: 'text-red-400', UNSET: 'text-slate-500' }

  const filteredAttrs: [string, unknown][] = Object.entries(span.attributes).filter(
    ([k]) => !k.startsWith('llm.') && k !== 'argus.run_id' && k !== 'argus.kind',
  )

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-800">
        <p className="text-sm font-semibold text-slate-100 break-all leading-snug">{span.name}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 uppercase">
            {span.kind}
          </span>
          <span className={clsx('text-xs font-mono', statusColor[span.status_code])}>
            {span.status_code}
          </span>
        </div>
        {span.status_message && (
          <p className="mt-1.5 text-xs text-red-400 font-mono">{span.status_message}</p>
        )}
      </div>

      {/* Timing */}
      <Section title="Timing">
        <Row label="Start"    value={fmt(span.start_time)} />
        {span.end_time && <Row label="End" value={fmt(span.end_time)} />}
        <Row label="Duration" value={duration(span.start_time, span.end_time)} />
      </Section>

      {/* Token usage — LLM spans only */}
      {hasTokens && (
        <Section title="Tokens">
          {tokens.input  != null && <Row label="Input"  value={tokens.input.toLocaleString()} />}
          {tokens.output != null && <Row label="Output" value={tokens.output.toLocaleString()} />}
          {tokens.total  != null && <Row label="Total"  value={tokens.total.toLocaleString()} />}
          {span.attributes['llm.model'] != null && (
            <Row label="Model" value={String(span.attributes['llm.model'])} />
          )}
        </Section>
      )}

      {/* Attributes */}
      {filteredAttrs.length > 0 && (
        <Section title="Attributes">
          <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all leading-relaxed">
            {JSON.stringify(Object.fromEntries(filteredAttrs), null, 2)}
          </pre>
        </Section>
      )}

      {/* Events */}
      {(span.events ?? []).length > 0 && (
        <Section title={`Events (${span.events.length})`}>
          {(span.events ?? []).map((ev, i) => (
            <div key={i} className="text-xs font-mono text-slate-400 border border-slate-700 rounded p-2">
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(ev, null, 2)}</pre>
            </div>
          ))}
        </Section>
      )}

      {/* IDs */}
      <Section title="IDs">
        <Row label="span_id"   value={<span className="text-[11px]">{span.span_id}</span>} />
        <Row label="trace_id"  value={<span className="text-[11px]">{span.trace_id}</span>} />
        {span.parent_span_id && (
          <Row label="parent" value={<span className="text-[11px]">{span.parent_span_id}</span>} />
        )}
      </Section>
    </div>
  )
}
