import { useCallback } from 'react'
import { useSessionStore } from '../store/session'

export function useClaudeBridge() {
  const store = useSessionStore()

  const brainstorm = useCallback(
    async (ideaText: string, stackPrefs: string[]) => {
      store.setLoading(true)
      store.setStreaming('')

      const unsubscribe = window.archon.onBrainstormChunk((chunk) => {
        if (chunk.done) {
          store.setLoading(false)
          const state = useSessionStore.getState()
          store.updateBrainstorm(state.streamingContent)
          if (state.id) {
            window.archon.artifact.save(state.id, 'brainstorm', state.streamingContent)
          }
        } else {
          store.appendStreaming(chunk.content)
        }
      })

      try {
        await window.archon.claude.brainstorm(ideaText, stackPrefs)
      } catch (err) {
        console.error('Brainstorm API call failed:', err)
        store.setLoading(false)
        // Save whatever we streamed so far so it's not lost
        const state = useSessionStore.getState()
        if (state.streamingContent) {
          store.updateBrainstorm(state.streamingContent)
          if (state.id) {
            window.archon.artifact.save(state.id, 'brainstorm', state.streamingContent)
          }
        }
        store.setError(err instanceof Error ? err.message : 'Brainstorm failed. You can retry.')
      }

      unsubscribe()
    },
    [store]
  )

  const generateArchitecture = useCallback(
    async (brainstormMd: string, stackPrefs: string[]) => {
      store.setLoading(true)
      store.setError(null)
      try {
        const result = await window.archon.claude.generateArchitecture(brainstormMd, stackPrefs)
        store.updateArchitecture(result)
        const sessionId = useSessionStore.getState().id
        if (sessionId) {
          await window.archon.artifact.save(sessionId, 'architecture', result)
        }
        return result
      } catch (err) {
        console.error('Architecture generation failed:', err)
        store.setError(err instanceof Error ? err.message : 'Architecture generation failed. You can retry.')
        throw err
      } finally {
        store.setLoading(false)
      }
    },
    [store]
  )

  const generateClaudeMd = useCallback(
    async (architectureMd: string, stack: string[]) => {
      store.setLoading(true)
      store.setError(null)
      try {
        const result = await window.archon.claude.generateClaudeMd(architectureMd, stack)
        store.updateClaudeMd(result)
        const sessionId = useSessionStore.getState().id
        if (sessionId) {
          await window.archon.artifact.save(sessionId, 'claude-md', result)
        }
        return result
      } catch (err) {
        console.error('CLAUDE.md generation failed:', err)
        store.setError(err instanceof Error ? err.message : 'CLAUDE.md generation failed. You can retry.')
        throw err
      } finally {
        store.setLoading(false)
      }
    },
    [store]
  )

  const generatePlan = useCallback(
    async (claudeMd: string, architectureMd: string) => {
      store.setLoading(true)
      store.setError(null)
      try {
        const result = await window.archon.claude.generatePlan(claudeMd, architectureMd)
        store.updatePlan(result)
        const sessionId = useSessionStore.getState().id
        if (sessionId) {
          await window.archon.artifact.save(sessionId, 'plan', result)
        }
        return result
      } catch (err) {
        console.error('Plan generation failed:', err)
        store.setError(err instanceof Error ? err.message : 'Plan generation failed. You can retry.')
        throw err
      } finally {
        store.setLoading(false)
      }
    },
    [store]
  )

  return {
    brainstorm,
    generateArchitecture,
    generateClaudeMd,
    generatePlan,
    isLoading: store.isLoading,
    streamingContent: store.streamingContent,
    error: store.error
  }
}
