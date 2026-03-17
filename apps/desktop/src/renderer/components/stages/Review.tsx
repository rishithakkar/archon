import { useState, useEffect } from 'react'
import { useSession } from '../../hooks/useSession'
import { useSessionStore } from '../../store/session'

export function Review() {
  const { projectPath } = useSession()
  const error = useSessionStore((s) => s.error)
  const setError = useSessionStore((s) => s.setError)
  const generatedProjectPath = useSessionStore((s) => s.generatedProjectPath)
  const [workDir, setWorkDir] = useState('')
  const [commitMessage, setCommitMessage] = useState('')
  const [mode, setMode] = useState<'idle' | 'reviewing' | 'done'>('idle')
  const [isSpawning, setIsSpawning] = useState(false)

  // Auto-set working directory: prefer auto-detected path, fall back to session projectPath
  useEffect(() => {
    if (generatedProjectPath) {
      setWorkDir(generatedProjectPath)
    } else if (projectPath) {
      setWorkDir(projectPath)
    }
  }, [generatedProjectPath, projectPath])

  const effectiveDir = workDir.trim()

  const runShellCommand = async (command: string): Promise<void> => {
    if (!effectiveDir) {
      setError('No project directory set.')
      return
    }
    try {
      await window.flowforge.pty.spawnShell(effectiveDir, command)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run command')
    }
  }

  const handleClaudeReview = async (): Promise<void> => {
    if (!effectiveDir) {
      setError('No project directory set.')
      return
    }
    setIsSpawning(true)
    setError(null)
    try {
      setMode('reviewing')
      const prompt = `Review the codebase in "${effectiveDir}" for quality, bugs, and best practices. Check:
1. Code structure and organization
2. Error handling
3. Security concerns
4. Performance issues
5. Missing tests or edge cases

Provide a summary of findings and suggest improvements. Do NOT make any changes — just report your findings.`
      await window.flowforge.pty.spawnWithPrompt(effectiveDir, 'plan', prompt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Claude CLI')
      setMode('idle')
    } finally {
      setIsSpawning(false)
    }
  }

  const handleCommit = async (): Promise<void> => {
    if (!commitMessage.trim() || !effectiveDir) return
    const escaped = commitMessage.replace(/"/g, '\\"')
    await runShellCommand(`git add -A && git commit -m "${escaped}"`)
  }

  const handleStop = async (): Promise<void> => {
    await window.flowforge.pty.kill()
    setMode('done')
  }

  const isRunning = mode === 'reviewing'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 shrink-0">
        <h2 className="text-2xl font-bold">Review</h2>
        <p className="mt-1 text-sm text-gray-400">
          {mode === 'idle' && 'Review changes, run a Claude code review, and commit your work.'}
          {mode === 'reviewing' && 'Claude is reviewing your code — check the terminal panel.'}
          {mode === 'done' && 'Review complete. Check findings in the terminal.'}
        </p>
      </div>

      {/* Status bar */}
      {isRunning && (
        <div className="mb-3 shrink-0 flex items-center justify-between rounded border border-gray-700 bg-gray-800/50 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full animate-pulse bg-purple-500" />
            <span className="text-sm font-medium text-gray-300">Code Review in Progress</span>
            <span className="text-xs text-gray-500">— Claude is analyzing your code →</span>
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

      {/* Working directory */}
      <div className="mb-4 shrink-0">
        <label className="mb-1.5 block text-sm font-medium text-gray-300">Project Directory</label>
        <input
          type="text"
          value={workDir}
          onChange={(e) => setWorkDir(e.target.value)}
          disabled={isRunning}
          className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 font-mono"
        />
        <p className="mt-1 text-xs text-gray-600">
          {generatedProjectPath
            ? '✓ Auto-detected from code generation.'
            : 'The directory where your project lives.'}
        </p>
      </div>

      {/* Git actions */}
      <div className="mb-4 shrink-0">
        <h3 className="mb-2 text-sm font-medium text-gray-300">Git Actions</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => runShellCommand('git status')}
            disabled={!effectiveDir}
            className="rounded border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            git status
          </button>
          <button
            onClick={() => runShellCommand('git diff --stat')}
            disabled={!effectiveDir}
            className="rounded border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            git diff --stat
          </button>
          <button
            onClick={() => runShellCommand('git diff')}
            disabled={!effectiveDir}
            className="rounded border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            git diff (full)
          </button>
          <button
            onClick={() => runShellCommand('git log --oneline -10')}
            disabled={!effectiveDir}
            className="rounded border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            git log
          </button>
          <button
            onClick={() => runShellCommand('code .')}
            disabled={!effectiveDir}
            className="rounded border border-gray-700 bg-gray-800/50 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            Open in VS Code
          </button>
        </div>
      </div>

      {/* Commit section */}
      <div className="mb-4 shrink-0 rounded border border-gray-800 bg-gray-800/20 p-4">
        <h3 className="mb-2 text-sm font-medium text-gray-300">Commit Changes</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="feat: initial implementation from FlowForge"
            className="flex-1 rounded bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-purple-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommit()
            }}
          />
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim() || !effectiveDir}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Commit
          </button>
        </div>
        <p className="mt-1.5 text-xs text-gray-600">
          Runs git add -A &amp;&amp; git commit. Output appears in the terminal.
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-4 shrink-0 rounded border border-blue-800/30 bg-blue-900/10 p-3">
        <div className="flex items-start gap-2">
          <span className="text-blue-400 text-sm mt-0.5">i</span>
          <div className="text-xs text-blue-300/70">
            <p className="font-medium text-blue-300 mb-1">Terminal Panel</p>
            <p>All git output and Claude&apos;s review findings appear in the terminal panel on the right. You can also type commands directly in the terminal input.</p>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1 min-h-0" />

      {/* Action buttons */}
      <div className="shrink-0 flex gap-3 pt-2 border-t border-gray-800">
        {!isRunning && (
          <button
            onClick={handleClaudeReview}
            disabled={isSpawning || !effectiveDir}
            className="flex-1 rounded bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {isSpawning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Starting Claude...
              </span>
            ) : (
              'Run Claude Code Review'
            )}
          </button>
        )}

        {mode === 'done' && (
          <button
            onClick={() => setMode('idle')}
            className="flex-1 rounded bg-gray-700 py-2.5 text-sm font-medium text-white hover:bg-gray-600"
          >
            Review Again
          </button>
        )}
      </div>
    </div>
  )
}
