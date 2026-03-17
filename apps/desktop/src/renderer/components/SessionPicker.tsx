import { useState, useEffect } from 'react'
import type { Stage } from '@archon/shared-types'

interface SessionSummary {
  id: string
  projectName: string
  currentStage: Stage
  updatedAt: number
}

interface SessionPickerProps {
  onResume: (sessionId: string) => void
  onNewSession: () => void
}

export function SessionPicker({ onResume, onNewSession }: SessionPickerProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.archon.session.list().then((list) => {
      setSessions(list)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return null // Will never actually render — parent handles this
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Welcome back</h2>
        <p className="mt-1 text-sm text-gray-400">
          Resume a previous session or start fresh.
        </p>
      </div>

      <div className="space-y-2">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onResume(s.id)}
            className="flex w-full items-center justify-between rounded border border-gray-700 bg-gray-800 px-4 py-3 text-left transition-colors hover:border-purple-500 hover:bg-gray-800/80"
          >
            <div>
              <div className="font-medium text-gray-200">{s.projectName}</div>
              <div className="mt-0.5 text-xs text-gray-500">
                Stage: {s.currentStage} &middot; Last updated: {new Date(s.updatedAt).toLocaleString()}
              </div>
            </div>
            <span className="text-xs text-purple-400">Resume &rarr;</span>
          </button>
        ))}
      </div>

      <div className="border-t border-gray-700 pt-4">
        <button
          onClick={onNewSession}
          className="w-full rounded bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
        >
          Start New Session
        </button>
      </div>
    </div>
  )
}
