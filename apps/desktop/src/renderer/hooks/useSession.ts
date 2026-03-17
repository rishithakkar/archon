import { useCallback } from 'react'
import { useSessionStore } from '../store/session'
import type { Stage } from '@archon/shared-types'

export function useSession() {
  const store = useSessionStore()

  const createSession = useCallback(
    async (projectName: string, ideaText: string, stackPrefs: string[], projectPath: string) => {
      store.setLoading(true)
      try {
        const session = await window.archon.session.create({
          projectName,
          ideaText,
          stackPrefs,
          projectPath
        })
        store.setSession(session)
        return session
      } finally {
        store.setLoading(false)
      }
    },
    [store]
  )

  const loadSession = useCallback(
    async (sessionId: string) => {
      store.setLoading(true)
      try {
        const session = await window.archon.session.load(sessionId)
        if (session) {
          store.setSession(session)
        }
        return session
      } finally {
        store.setLoading(false)
      }
    },
    [store]
  )

  const listSessions = useCallback(async () => {
    return window.archon.session.list()
  }, [])

  const advanceStage = useCallback(
    async (stage: Stage) => {
      const sessionId = useSessionStore.getState().id
      if (sessionId) {
        await window.archon.session.updateStage(sessionId, stage)
      }
      store.setStage(stage)
    },
    [store]
  )

  return {
    ...store,
    createSession,
    loadSession,
    listSessions,
    advanceStage
  }
}
