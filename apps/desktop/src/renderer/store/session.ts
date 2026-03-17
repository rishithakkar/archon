import { create } from 'zustand'
import { Stage } from '@flowforge/shared-types'
import type { SessionState, Checkpoint } from '@flowforge/shared-types'

const STAGE_ORDER = Object.values(Stage)

function maxStage(a: Stage, b: Stage): Stage {
  return STAGE_ORDER.indexOf(a) >= STAGE_ORDER.indexOf(b) ? a : b
}

interface SessionStore extends SessionState {
  isLoading: boolean
  streamingContent: string
  error: string | null
  highestStage: Stage // furthest stage reached — controls which sidebar items are clickable

  // Actions
  setSession: (session: SessionState) => void
  setStage: (stage: Stage) => void
  navigateTo: (stage: Stage) => void // view a stage without advancing
  updateIdeaText: (text: string) => void
  updateStackPrefs: (prefs: string[]) => void
  updateBrainstorm: (md: string) => void
  updateArchitecture: (md: string) => void
  updateClaudeMd: (md: string) => void
  updatePlan: (md: string) => void
  setGeneratedProjectPath: (path: string) => void
  addCheckpoint: (checkpoint: Checkpoint) => void
  resolveCheckpoint: (id: string, status: 'approved' | 'rejected') => void
  setStreaming: (content: string) => void
  appendStreaming: (chunk: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

const initialState = {
  id: '',
  projectName: '',
  currentStage: Stage.IdeaInput,
  highestStage: Stage.IdeaInput,
  ideaText: '',
  stackPrefs: [] as string[],
  brainstormMd: '',
  architectureMd: '',
  claudeMd: '',
  planMd: '',
  projectPath: '',
  generatedProjectPath: '' as string,
  checkpoints: [] as Checkpoint[],
  createdAt: 0,
  updatedAt: 0,
  isLoading: false,
  streamingContent: '',
  error: null as string | null
}

export const useSessionStore = create<SessionStore>((set) => ({
  ...initialState,

  setSession: (session) =>
    set({
      ...session,
      highestStage: session.currentStage,
      isLoading: false,
      streamingContent: '',
      error: null
    }),

  // Advance stage — also updates highestStage
  setStage: (stage) =>
    set((state) => ({
      currentStage: stage,
      highestStage: maxStage(state.highestStage, stage)
    })),

  // Navigate to a previously reached stage (view only, doesn't advance)
  navigateTo: (stage) => set({ currentStage: stage }),

  updateIdeaText: (text) => set({ ideaText: text }),

  updateStackPrefs: (prefs) => set({ stackPrefs: prefs }),

  updateBrainstorm: (md) => set({ brainstormMd: md }),

  updateArchitecture: (md) => set({ architectureMd: md }),

  updateClaudeMd: (md) => set({ claudeMd: md }),

  updatePlan: (md) => set({ planMd: md }),

  setGeneratedProjectPath: (path) => set({ generatedProjectPath: path }),

  addCheckpoint: (checkpoint) =>
    set((state) => ({
      checkpoints: [...state.checkpoints, checkpoint]
    })),

  resolveCheckpoint: (id, status) =>
    set((state) => ({
      checkpoints: state.checkpoints.map((cp) =>
        cp.id === id ? { ...cp, status } : cp
      )
    })),

  setStreaming: (content) => set({ streamingContent: content }),

  appendStreaming: (chunk) =>
    set((state) => ({
      streamingContent: state.streamingContent + chunk
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState)
}))
