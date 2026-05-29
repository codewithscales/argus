interface Props {
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  status: string
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 border-b border-slate-800">
        {title}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

function JsonBlock({ value }: { value: Record<string, unknown> }) {
  return (
    <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap break-all leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export default function ResponsePanel({ input, output, status }: Props) {
  const isRunning = status === 'running' || status === 'pending'

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="px-4 py-4 border-b border-slate-800">
        <p className="text-sm font-semibold text-slate-100">Agent Response</p>
        <p className="text-xs text-slate-500 mt-0.5">Input sent and output received</p>
      </div>

      <Section title="Input">
        <JsonBlock value={input} />
      </Section>

      <Section title="Output">
        {output ? (
          <JsonBlock value={output} />
        ) : isRunning ? (
          <p className="text-sm text-slate-500 animate-pulse">Waiting for response…</p>
        ) : (
          <p className="text-sm text-slate-600">No output recorded</p>
        )}
      </Section>
    </div>
  )
}
