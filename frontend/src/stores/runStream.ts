import { create } from 'zustand'
import type { Span } from '@/types'

interface RunStreamState {
  spans: Record<string, Span>
  runStatus: string | null
  runOutput: Record<string, unknown> | null
  isConnected: boolean
  selectedSpanId: string | null
}

interface RunStreamActions {
  addOrUpdateSpan: (data: Partial<Span> & { span_id: string }) => void
  setRunStatus: (status: string) => void
  setRunOutput: (output: Record<string, unknown> | null) => void
  setConnected: (v: boolean) => void
  selectSpan: (spanId: string | null) => void
  reset: () => void
}

const INITIAL: RunStreamState = {
  spans: {},
  runStatus: null,
  runOutput: null,
  isConnected: false,
  selectedSpanId: null,
}

export const useRunStreamStore = create<RunStreamState & RunStreamActions>((set) => ({
  ...INITIAL,

  addOrUpdateSpan: (data) =>
    set((state) => ({
      spans: {
        ...state.spans,
        [data.span_id]: { ...state.spans[data.span_id], ...data } as Span,
      },
    })),

  setRunStatus:  (runStatus) => set({ runStatus }),
  setRunOutput:  (runOutput) => set({ runOutput }),
  setConnected:  (isConnected) => set({ isConnected }),
  selectSpan:    (selectedSpanId) => set({ selectedSpanId }),
  reset:         () => set(INITIAL),
}))
