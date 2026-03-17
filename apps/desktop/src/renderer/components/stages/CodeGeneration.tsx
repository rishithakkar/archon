import { useState, useMemo, useEffect } from 'react'
import { marked } from 'marked'
import { Stage } from '@flowforge/shared-types'
import { useSession } from '../../hooks/useSession'
import { useSessionStore } from '../../store/session'

export function CodeGeneration() {
  const { planMd, claudeMd, projectPath, advanceStage } = useSession()
  const error = useSessionStore((s) => s.error)
  const setError = useSessionStore((s) => s.setError)
  const setGeneratedProjectPath = useSessionStore((s) => s.setGeneratedProjectPath)
  const [mode, setMode] = useState<'idle' | 'running' | 'done'>('idle')
  const [activeTab, setActiveTab] = useState<'plan' | 'claudemd'>('plan')
  const [isSpawning, setIsSpawning] = useState(false)

  // Listen for auto-detected project path from Claude's file operations
  useEffect(() => {
    const unsubscribe = window.flowforge.onProjectPathDetected((path: string) => {
      setGeneratedProjectPath(path)
    })
    return unsubscribe
  }, [setGeneratedProjectPath])

  const planHtml = useMemo(() => (planMd ? marked(planMd) as string : ''), [planMd])
  const claudeMdHtml = useMemo(() => (claudeMd ? marked(claudeMd) as string : ''), [claudeMd])

  const handleExecutePlan = async (): Promise<void> => {
    if (!projectPath) {
      setError('No project path set. Go back to Idea Input and set a project path.')
      return
    }
    setIsSpawning(true)
    setError(null)
    try {
      setMode('running')
      const prompt = [
        'IMPORTANT INSTRUCTIONS:',
        '- You have FULL write permission to this project directory. Do NOT ask for approval.',
        '- Create all directories, files, and code immediately without confirmation.',
        '- Execute the entire plan from start to finish in one pass.',
        '- Do NOT summarize the plan or ask questions. Just start building.',
        '',
        'PROJECT CONVENTIONS (CLAUDE.md):',
        claudeMd || '(none provided)',
        '',
        'IMPLEMENTATION PLAN — Execute every step below:',
        planMd || '(no plan provided)'
      ].join('\n')
      await window.flowforge.pty.spawnWithPrompt(projectPath, 'auto', prompt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Claude CLI')
      setMode('idle')
    } finally {
      setIsSpawning(false)
    }
  }

  const handleStop = async (): Promise<void> => {
    await window.flowforge.pty.kill()
    setMode('done')
  }

  const handleAdvance = async (): Promise<void> => {
    await window.flowforge.pty.kill()
    await advanceStage(Stage.Testing)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 shrink-0">
        <h2 className="text-2xl font-bold">Code Generation</h2>
        <p className="mt-1 text-sm text-gray-400">
          {mode === 'idle' && 'Review the plan, then let Claude build your project.'}
          {mode === 'running' && 'Claude is building your project — watch progress in the terminal.'}
          {mode === 'done' && 'Execution finished. Review the output, then continue to Testing.'}
        </p>
      </div>

      {/* Status bar */}
      {mode === 'running' && (
        <div className="mb-3 shrink-0 flex items-center justify-between rounded border border-gray-700 bg-gray-800/50 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full animate-pulse bg-green-500" />
            <span className="text-sm font-medium text-gray-300">Building...</span>
            <span className="text-xs text-gray-500">Claude is creating files and writing code →</span>
          </div>
          <button
            onClick={handleStop}
            className="rounded bg-red-600/20 border border-red-600/30 px-3 py-1 text-xs text-red-400 hover:bg-red-600/30"
          >
            Stop
          </button>
        </div>
      )}

      {error && (
        <div className="mb-3 shrink-0 rounded border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Plan / CLAUDE.md tabs */}
      <div className="mb-2 shrink-0 flex items-center gap-4">
        <div className="flex rounded border border-gray-700 bg-gray-800/50">
          <button
            onClick={() => setActiveTab('plan')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'plan' ? 'bg-purple-600 text-white rounded-l' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Plan
          </button>
          <button
            onClick={() => setActiveTab('claudemd')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === 'claudemd' ? 'bg-purple-600 text-white rounded-r' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            CLAUDE.md
          </button>
        </div>
        {mode !== 'idle' && (
          <span className="text-xs text-gray-500">
            Watch progress in the terminal panel →
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded border border-gray-800 bg-gray-900/50 p-4 mb-3">
        {activeTab === 'plan' ? (
          planMd ? (
            <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: planHtml }} />
          ) : (
            <p className="text-sm text-gray-500">No plan generated yet. Go back to Architecture to generate one.</p>
          )
        ) : (
          claudeMd ? (
            <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: claudeMdHtml }} />
          ) : (
            <p className="text-sm text-gray-500">No CLAUDE.md generated yet.</p>
          )
        )}
      </div>

      {/* Action buttons */}
      <div className="shrink-0 flex gap-3 pt-2 border-t border-gray-800">
        {mode === 'idle' && (
          <button
            onClick={handleExecutePlan}
            disabled={!planMd || isSpawning}
            className="flex-1 rounded bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isSpawning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Starting Claude...
              </span>
            ) : (
              'Execute Plan with Claude'
            )}
          </button>
        )}

        {mode === 'done' && (
          <button
            onClick={() => setMode('idle')}
            className="flex-1 rounded bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700"
          >
            Run Again
          </button>
        )}

        {(mode === 'running' || mode === 'done') && (
          <button
            onClick={handleAdvance}
            className="flex-1 rounded bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            Continue to Testing →
          </button>
        )}
      </div>
    </div>
  )
}
