import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ResponsePanel from './ResponsePanel'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleInput = { prompt: 'Hello, world!', temperature: 0.7 }
const sampleOutput = { text: 'Hi there!', tokens_used: 12 }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResponsePanel', () => {
  describe('Input section', () => {
    it('always renders the Input section heading', () => {
      render(<ResponsePanel input={sampleInput} output={null} status="completed" />)
      // Use exact match to distinguish the "Input" heading from "Input sent and output received"
      expect(screen.getByText('Input')).toBeInTheDocument()
    })

    it('renders the JSON of the input prop', () => {
      render(<ResponsePanel input={sampleInput} output={null} status="completed" />)
      // JSON.stringify with indent 2 produces keys on their own lines
      expect(screen.getByText(/"prompt"/)).toBeInTheDocument()
      expect(screen.getByText(/"temperature"/)).toBeInTheDocument()
    })
  })

  describe('Output section — waiting states', () => {
    it('shows "Waiting for response…" when status is running and output is null', () => {
      render(<ResponsePanel input={sampleInput} output={null} status="running" />)
      expect(screen.getByText('Waiting for response…')).toBeInTheDocument()
    })

    it('shows "Waiting for response…" when status is pending and output is null', () => {
      render(<ResponsePanel input={sampleInput} output={null} status="pending" />)
      expect(screen.getByText('Waiting for response…')).toBeInTheDocument()
    })
  })

  describe('Output section — output present', () => {
    it('renders the JSON of the output prop when output is provided', () => {
      render(<ResponsePanel input={sampleInput} output={sampleOutput} status="completed" />)
      expect(screen.getByText(/"text"/)).toBeInTheDocument()
      expect(screen.getByText(/"tokens_used"/)).toBeInTheDocument()
    })

    it('does NOT show the waiting message when output is present', () => {
      render(<ResponsePanel input={sampleInput} output={sampleOutput} status="running" />)
      expect(screen.queryByText('Waiting for response…')).not.toBeInTheDocument()
    })
  })

  describe('Output section — no output recorded', () => {
    it('shows "No output recorded" when status is completed and output is null', () => {
      render(<ResponsePanel input={sampleInput} output={null} status="completed" />)
      expect(screen.getByText('No output recorded')).toBeInTheDocument()
    })

    it('shows "No output recorded" when status is failed and output is null', () => {
      render(<ResponsePanel input={sampleInput} output={null} status="failed" />)
      expect(screen.getByText('No output recorded')).toBeInTheDocument()
    })
  })
})
