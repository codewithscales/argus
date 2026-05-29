# ADR-005: Flow Visualization

**Date:** 2026-05-29  
**Status:** Accepted

## Context

The central UI feature of Argus is the flow graph — a visual representation of an agent run as a directed acyclic graph (DAG). Requirements:

- Nodes represent spans (LLM calls, tool calls, sub-agents, custom steps)
- Edges represent parent-child relationships from the span tree
- Graph must update live as spans stream in over WebSocket
- Nodes must be clickable to open the span inspector
- Layout should be readable for both shallow wide graphs (many parallel tool calls) and deep narrow graphs (chained LLM calls)
- Nodes should be visually differentiated by span kind (LLM, tool, agent, custom)

## Decision

Use **ReactFlow** (`@xyflow/react`).

ReactFlow is chosen because:
- Purpose-built for interactive node-edge graphs in React; handles pan, zoom, selection, and mini-map out of the box
- Custom node renderers are plain React components — easy to build a `SpanNode` with status color, name, duration badge
- Incremental node/edge updates via `useNodesState` / `useEdgesState` work naturally with streamed spans arriving over WebSocket
- Dagre layout algorithm (`dagre` library) integrates directly to auto-arrange the tree top-to-bottom or left-to-right
- Active maintenance, good TypeScript types

## Layout Algorithm

Use **dagre** for automatic hierarchical layout:
- Direction: top-to-bottom (LR for wide graphs, toggle available)
- Re-run layout on each new span batch (debounced to avoid constant reflow)
- Preserve node positions once manually dragged by the user (set `draggable: true`, persist drag offsets in local component state)

## Node Types

| Kind | Color | Icon |
|---|---|---|
| `llm` | Blue | Brain/sparkle |
| `tool` | Green | Wrench |
| `agent` | Purple | Robot |
| `retrieval` | Orange | Database |
| `custom` | Grey | Dot |

Status overlays: running (pulsing border), success (solid), error (red border + error badge).

## Consequences

**Positive:**
- Minimal boilerplate for a production-quality interactive graph
- Custom nodes keep the visual design fully under control
- Works well with incremental updates — no full re-render on each span

**Negative:**
- ReactFlow's free tier has a subtle attribution requirement (small logo); acceptable for a personal tool
- Dagre produces good but not perfect layouts for complex graphs; may need manual tweaks for highly parallel sub-agent trees

## Alternatives Considered

| Option | Reason rejected |
|---|---|
| D3.js force graph | Not DAG-native; requires significant custom layout code |
| Cytoscape.js | More graph-theory features than needed; React integration is a wrapper, not native |
| Mermaid | Static render only; no interactivity |