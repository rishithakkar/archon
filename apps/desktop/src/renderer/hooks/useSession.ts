import { useCallback } from 'react'
import { useSessionStore } from '../store/session'
import type { Stage } from '@flowforge/shared-types'

export function useSession() {
  const store = useSessionStore()

  const createSession = useCallback(
    async (projectName: string, ideaText: string, stackPrefs: string[], projectPath: string) => {
      store.setLoading(true)
      try {
        const session = await window.flowforge.session.create({
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
        const session = await window.flowforge.session.load(sessionId)
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
    return window.flowforge.session.list()
  }, [])

  const advanceStage = useCallback(
    async (stage: Stage) => {
      const sessionId = useSessionStore.getState().id
      if (sessionId) {
        await window.flowforge.session.updateStage(sessionId, stage)
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
