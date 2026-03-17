import { useEffect, useState, useCallback } from 'react'
import { Stage } from '@flowforge/shared-types'
import type { Checkpoint } from '@flowforge/shared-types'
import { useSessionStore } from './store/session'
import { TopBar } from './components/layout/TopBar'
import { Sidebar } from './components/layout/Sidebar'
import { TerminalPanel } from './components/layout/TerminalPanel'
import { IdeaInput } from './components/stages/IdeaInput'
import { Brainstorm } from './components/stages/Brainstorm'
import { Architecture } from './components/stages/Architecture'
import { CodeGeneration } from './components/stages/CodeGeneration'
import { Testing } from './components/stages/Testing'
import { Review } from './components/stages/Review'
import { HumanGate } from './components/shared/HumanGate'
import { SessionPicker } from './components/SessionPicker'

function StageContent() {
  const currentStage = useSessionStore((s) => s.currentStage)

  switch (currentStage) {
    case Stage.IdeaInput:
      return <IdeaInput />
    case Stage.Brainstorm:
      return <Brainstorm />
    case Stage.Architecture:
      return <Architecture />
    case Stage.CodeGeneration:
      return <CodeGeneration />
    case Stage.Testing:
      return <Testing />
    case Stage.Review:
      return <Review />
    default:
      return <IdeaInput />
  }
}

const TERMINAL_STAGES = new Set([Stage.CodeGeneration, Stage.Testing, Stage.Review])

function App(): JSX.Element {
  const [pendingCheckpoint, setPendingCheckpoint] = useState<Checkpoint | null>(null)
  const [showPicker, setShowPicker] = useState<boolean | null>(null) // null = loading
  const [terminalWidth, setTerminalWidth] = useState(350)
  const currentStage = useSessionStore((s) => s.currentStage)
  const addCheckpoint = useSessionStore((s) => s.addCheckpoint)
  const resolveCheckpoint = useSessionStore((s) => s.resolveCheckpoint)
  const setSession = useSessionStore((s) => s.setSession)
  const reset = useSessionStore((s) => s.reset)

  const showTerminal = TERMINAL_STAGES.has(currentStage)

  // On startup, check if there are existing sessions to resume
  useEffect(() => {
    window.flowforge.session.list().then((sessions) => {
      if (sessions.length > 0) {
        setShowPicker(true)
      } else {
        setShowPicker(false)
      }
    })
  }, [])

  const handleResume = useCallback(async (sessionId: string) => {
    const session = await window.flowforge.session.load(sessionId)
    if (session) {
      setSession(session)
    }
    setShowPicker(false)
  }, [setSession])

  const handleNewSession = useCallback(() => {
    reset()
    setShowPicker(false)
  }, [reset])

  const handleExitSession = useCallback(() => {
    reset()
    setShowPicker(true)
  }, [reset])

  useEffect(() => {
    const unsubscribe = window.flowforge.onCheckpoint((checkpoint) => {
      const cp = checkpoint as Checkpoint
      addCheckpoint(cp)
      setPendingCheckpoint(cp)
    })
    return unsubscribe
  }, [addCheckpoint])

  const handleApprove = async (checkpointId: string): Promise<void> => {
    await window.flowforge.checkpoint.approve(checkpointId)
    resolveCheckpoint(checkpointId, 'approved')
    setPendingCheckpoint(null)
  }

  const handleReject = async (checkpointId: string, feedback: string): Promise<void> => {
    await window.flowforge.checkpoint.reject(checkpointId, feedback)
    resolveCheckpoint(checkpointId, 'rejected')
    setPendingCheckpoint(null)
  }

  // Show loading spinner while checking for sessions
  if (showPicker === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-gray-900 text-white">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar onExitSession={handleExitSession} />
        <main className="relative flex-1 overflow-y-auto p-6">
          {showPicker ? (
            <SessionPicker onResume={handleResume} onNewSession={handleNewSession} />
          ) : (
            <StageContent />
          )}
          {pendingCheckpoint && (
            <HumanGate
              checkpoint={pendingCheckpoint}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
        </main>
        {showTerminal && (
          <TerminalPanel width={terminalWidth} onWidthChange={setTerminalWidth} />
        )}
      </div>
    </div>
  )
}

export default App
