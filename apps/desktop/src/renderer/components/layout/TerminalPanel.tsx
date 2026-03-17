import { useRef, useState, useCallback, useEffect } from 'react'
import { useTerminal } from '../../hooks/useTerminal'

const MIN_WIDTH = 250
const MAX_WIDTH = 800

interface TerminalPanelProps {
  width: number
  onWidthChange: (width: number) => void
}

export function TerminalPanel({ width, onWidthChange }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { write, fit } = useTerminal(containerRef)
  const [input, setInput] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (input.trim()) {
      write(input + '\n')
      setInput('')
    }
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { startX: e.clientX, startWidth: width }
  }, [width])

  // Re-fit terminal when width changes
  useEffect(() => {
    const timer = setTimeout(() => fit(), 50)
    return () => clearTimeout(timer)
  }, [width, fit])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return
      // Dragging left edge — moving left increases width
      const delta = dragStartRef.current.startX - e.clientX
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartRef.current.startWidth + delta))
      onWidthChange(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [isDragging, onWidthChange])

  return (
    <div
      className="relative flex h-full shrink-0 flex-col border-l border-gray-800 bg-[#1a1a1a]"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle — left edge */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize transition-colors hover:bg-purple-500/40 ${
          isDragging ? 'bg-purple-500/60' : 'bg-transparent'
        }`}
      />

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
        <span className="text-xs font-medium text-gray-400">Terminal</span>
        <span className="rounded bg-green-600/20 px-1.5 py-0.5 text-[10px] font-medium text-green-400">
          LIVE
        </span>
        <span className="ml-auto text-[10px] text-gray-600">{width}px</span>
      </div>

      {/* Terminal content */}
      <div ref={containerRef} className="flex-1 overflow-hidden" />

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-800 p-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message or command..."
            className="flex-1 rounded bg-gray-800 px-2 py-1 text-sm text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-purple-500"
          />
          <button
            type="submit"
            className="rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
