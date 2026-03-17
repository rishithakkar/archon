import { useState, useEffect } from 'react'
import { Stage } from '@archon/shared-types'
import { useSession } from '../../hooks/useSession'
import { useSessionStore } from '../../store/session'

export function Testing() {
  const { projectPath, advanceStage } = useSession()
  const error = useSessionStore((s) => s.error)
  const setError = useSessionStore((s) => s.setError)
  const generatedProjectPath = useSessionStore((s) => s.generatedProjectPath)
  const [testCommand, setTestCommand] = useState('npm test')
  const [workDir, setWorkDir] = useState('')
  const [mode, setMode] = useState<'idle' | 'manual' | 'claude' | 'done'>('idle')
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

  const handleRunManual = async (): Promise<void> => {
    if (!effectiveDir) {
      setError('Please set a working directory first.')
      return
    }
    if (!testCommand.trim()) return

    setIsSpawning(true)
    setError(null)
    try {
      setMode('manual')
      await window.archon.pty.spawnShell(effectiveDir, testCommand.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start process')
      setMode('idle')
    } finally {
      setIsSpawning(false)
    }
  }

  const handleRunWithClaude = async (): Promise<void> => {
    if (!effectiveDir) {
      setError('Please set a working directory first.')
      return
    }

    setIsSpawning(true)
    setError(null)
    try {
      setMode('claude')
      const prompt = `The project is located at "${effectiveDir}". Run the test suite using "${testCommand.trim()}". If any tests fail, analyze the failures and fix the code. Keep running tests until they all pass or you've made 3 fix attempts. Report the final status.`
      await window.archon.pty.spawnWithPrompt(effectiveDir, 'auto', prompt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Claude CLI')
      setMode('idle')
    } finally {
      setIsSpawning(false)
    }
  }

  const handleStop = async (): Promise<void> => {
    await window.archon.pty.kill()
    setMode('done')
  }

  const handleAdvance = async (): Promise<void> => {
    await window.archon.pty.kill()
    await advanceStage(Stage.Review)
  }

  const isRunning = mode === 'manual' || mode === 'claude'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 shrink-0">
        <h2 className="text-2xl font-bold">Testing</h2>
        <p className="mt-1 text-sm text-gray-400">
          {mode === 'idle' && 'Run your test suite manually or let Claude run and fix failing tests.'}
          {mode === 'manual' && 'Running tests — check the terminal panel for output.'}
          {mode === 'claude' && 'Claude is running tests and fixing failures automatically.'}
          {mode === 'done' && 'Testing complete. Review the results in the terminal, then continue.'}
        </p>
      </div>

      {/* Status bar */}
      {isRunning && (
        <div className="mb-3 shrink-0 flex items-center justify-between rounded border border-gray-700 bg-gray-800/50 px-4 py-2">
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full animate-pulse ${mode === 'manual' ? 'bg-blue-500' : 'bg-green-500'}`} />
            <span className="text-sm font-medium text-gray-300">
              {mode === 'manual' ? 'Running Tests' : 'Claude Auto-Fix'}
            </span>
            <span className="text-xs text-gray-500">
              {mode === 'manual' ? '— Watch output in terminal →' : '— Claude will run tests and fix failures →'}
            </span>
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
      <div className="mb-3 shrink-0">
        <label className="mb-1.5 block text-sm font-medium text-gray-300">Project Directory</label>
        <input
          type="text"
          value={workDir}
          onChange={(e) => setWorkDir(e.target.value)}
          disabled={isRunning}
          placeholder="D:\works\my-project"
          className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 font-mono"
        />
        <p className="mt-1 text-xs text-gray-600">
          {generatedProjectPath
            ? '✓ Auto-detected from code generation. You can override if needed.'
            : 'The directory where your project lives. Update this if Claude created a subdirectory.'}
        </p>
      </div>

      {/* Test command input */}
      <div className="mb-4 shrink-0">
        <label className="mb-1.5 block text-sm font-medium text-gray-300">Test Command</label>
        <input
          type="text"
          value={testCommand}
          onChange={(e) => setTestCommand(e.target.value)}
          disabled={isRunning}
          placeholder="npm test"
          className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-gray-600">
          The command to run your test suite (e.g., npm test, pytest, cargo test)
        </p>
      </div>

      {/* Info banner */}
      <div className="mb-4 shrink-0 rounded border border-blue-800/30 bg-blue-900/10 p-3">
        <div className="flex items-start gap-2">
          <span className="text-blue-400 text-sm mt-0.5">i</span>
          <div className="text-xs text-blue-300/70">
            <p className="font-medium text-blue-300 mb-1">How it works</p>
            <p><strong>Run Tests Manually</strong> — Runs your test command directly in the terminal. You see the raw output.</p>
            <p className="mt-1"><strong>Run &amp; Fix with Claude</strong> — Claude runs the tests, analyzes any failures, fixes the code, and re-runs until tests pass.</p>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1 min-h-0" />

      {/* Action buttons */}
      <div className="shrink-0 flex gap-3 pt-2 border-t border-gray-800">
        {mode === 'idle' && (
          <>
            <button
              onClick={handleRunManual}
              disabled={!testCommand.trim() || !effectiveDir || isSpawning}
              className="flex-1 rounded bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSpawning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Starting...
                </span>
              ) : (
                'Run Tests Manually'
              )}
            </button>
            <button
              onClick={handleRunWithClaude}
              disabled={!testCommand.trim() || !effectiveDir || isSpawning}
              className="flex-1 rounded bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isSpawning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Starting Claude...
                </span>
              ) : (
                'Run & Fix with Claude'
              )}
            </button>
          </>
        )}

        {mode === 'done' && (
          <button
            onClick={() => setMode('idle')}
            className="flex-1 rounded bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Run Again
          </button>
        )}

        {(mode === 'manual' || mode === 'claude' || mode === 'done') && (
          <button
            onClick={handleAdvance}
            className="flex-1 rounded bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            Continue to Review →
          </button>
        )}
      </div>
    </div>
  )
}
