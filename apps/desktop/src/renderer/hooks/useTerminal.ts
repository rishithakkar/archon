import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'

export function useTerminal(containerRef: React.RefObject<HTMLDivElement | null>) {
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: '#1a1a1a',
        foreground: '#e0e0e0',
        cursor: '#a855f7',
        selectionBackground: '#a855f750'
      },
      convertEol: true,
      allowProposedApi: true,
      rightClickSelectsWord: true
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(new WebLinksAddon())

    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Forward keyboard input to PTY
    terminal.onData((data) => {
      window.archon.pty.write(data)
    })

    // Handle copy with Ctrl+C / Cmd+C when there's a selection
    terminal.attachCustomKeyEventHandler((e) => {
      // Ctrl+C or Cmd+C with selection = copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && terminal.hasSelection()) {
        const selection = terminal.getSelection()
        if (selection) {
          navigator.clipboard.writeText(selection)
        }
        return false // prevent sending to PTY
      }
      // Ctrl+V or Cmd+V = paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        navigator.clipboard.readText().then((text) => {
          window.archon.pty.write(text)
        })
        return false
      }
      // Ctrl+A or Cmd+A = select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        terminal.selectAll()
        return false
      }
      return true
    })

    // Receive PTY output
    const unsubscribe = window.archon.onTerminalData((data) => {
      terminal.write(data)
    })

    const handleResize = (): void => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      unsubscribe()
      window.removeEventListener('resize', handleResize)
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, [containerRef])

  const write = useCallback((data: string) => {
    // Write to both PTY and terminal display
    window.archon.pty.write(data)
  }, [])

  const fit = useCallback(() => {
    fitAddonRef.current?.fit()
  }, [])

  return { write, fit, terminal: terminalRef }
}
