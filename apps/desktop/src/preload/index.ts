import { contextBridge, ipcRenderer } from 'electron'
import type { SessionState, Stage, PtyMode, Artifact } from '@archon/shared-types'

const api = {
  session: {
    create: (params: { projectName: string; ideaText: string; stackPrefs: string[]; projectPath: string }): Promise<SessionState> =>
      ipcRenderer.invoke('session:create', params),
    load: (sessionId: string): Promise<SessionState | null> =>
      ipcRenderer.invoke('session:load', { sessionId }),
    list: (): Promise<Array<{ id: string; projectName: string; currentStage: Stage; updatedAt: number }>> =>
      ipcRenderer.invoke('session:list'),
    updateStage: (sessionId: string, stage: Stage): Promise<void> =>
      ipcRenderer.invoke('session:update-stage', { sessionId, stage })
  },

  claude: {
    brainstorm: (ideaText: string, stackPrefs: string[]): Promise<void> =>
      ipcRenderer.invoke('claude:brainstorm', { ideaText, stackPrefs }),
    generateArchitecture: (brainstormMd: string, stackPrefs: string[]): Promise<string> =>
      ipcRenderer.invoke('claude:generate-architecture', { brainstormMd, stackPrefs }),
    generateClaudeMd: (architectureMd: string, stack: string[]): Promise<string> =>
      ipcRenderer.invoke('claude:generate-claude-md', { architectureMd, stack }),
    generatePlan: (claudeMd: string, architectureMd: string): Promise<string> =>
      ipcRenderer.invoke('claude:generate-plan', { claudeMd, architectureMd }),
    refineBrainstorm: (currentVersion: string, userFeedback: string, ideaText: string): Promise<void> =>
      ipcRenderer.invoke('claude:refine-brainstorm', { currentVersion, userFeedback, ideaText }),
    refineArchitecture: (currentVersion: string, userFeedback: string, sectionName: string | null): Promise<void> =>
      ipcRenderer.invoke('claude:refine-architecture', { currentVersion, userFeedback, sectionName })
  },

  pty: {
    spawn: (projectPath: string, mode: PtyMode): Promise<void> =>
      ipcRenderer.invoke('pty:spawn', { projectPath, mode }),
    spawnWithPrompt: (projectPath: string, mode: PtyMode, prompt: string): Promise<void> =>
      ipcRenderer.invoke('pty:spawn-with-prompt', { projectPath, mode, prompt }),
    spawnShell: (projectPath: string, command: string): Promise<void> =>
      ipcRenderer.invoke('pty:spawn-shell', { projectPath, command }),
    write: (data: string): void =>
      ipcRenderer.send('pty:write', { data }),
    kill: (): Promise<void> =>
      ipcRenderer.invoke('pty:kill')
  },

  checkpoint: {
    approve: (checkpointId: string): Promise<void> =>
      ipcRenderer.invoke('checkpoint:approve', { checkpointId }),
    reject: (checkpointId: string, feedback: string): Promise<void> =>
      ipcRenderer.invoke('checkpoint:reject', { checkpointId, feedback })
  },

  artifact: {
    save: (sessionId: string, type: Artifact['type'], content: string): Promise<void> =>
      ipcRenderer.invoke('artifact:save', { sessionId, type, content }),
    load: (sessionId: string, type: Artifact['type']): Promise<string | null> =>
      ipcRenderer.invoke('artifact:load', { sessionId, type })
  },

  onTerminalData: (callback: (data: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: string): void => {
      callback(data)
    }
    ipcRenderer.on('terminal:data', handler)
    return () => ipcRenderer.removeListener('terminal:data', handler)
  },

  onArchitectureChunk: (callback: (chunk: { content: string; done: boolean }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: { content: string; done: boolean }): void => {
      callback(chunk)
    }
    ipcRenderer.on('claude:architecture:chunk', handler)
    return () => ipcRenderer.removeListener('claude:architecture:chunk', handler)
  },

  onBrainstormChunk: (callback: (chunk: { content: string; done: boolean }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: { content: string; done: boolean }): void => {
      callback(chunk)
    }
    ipcRenderer.on('claude:brainstorm:chunk', handler)
    return () => ipcRenderer.removeListener('claude:brainstorm:chunk', handler)
  },

  onCheckpoint: (callback: (checkpoint: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, checkpoint: unknown): void => {
      callback(checkpoint)
    }
    ipcRenderer.on('session:checkpoint', handler)
    return () => ipcRenderer.removeListener('session:checkpoint', handler)
  },

  onProjectPathDetected: (callback: (path: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, path: string): void => {
      callback(path)
    }
    ipcRenderer.on('pty:project-path-detected', handler)
    return () => ipcRenderer.removeListener('pty:project-path-detected', handler)
  }
}

contextBridge.exposeInMainWorld('archon', api)

export type ArchonAPI = typeof api
