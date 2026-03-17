export enum Stage {
  IdeaInput = 'IdeaInput',
  Brainstorm = 'Brainstorm',
  Architecture = 'Architecture',
  CodeGeneration = 'CodeGeneration',
  Testing = 'Testing',
  Review = 'Review'
}

export interface Checkpoint {
  id: string
  stage: Stage
  description: string
  diffSummary: string
  status: 'pending' | 'approved' | 'rejected'
  feedback?: string
  createdAt: number
}

export interface Artifact {
  id: string
  sessionId: string
  type: 'brainstorm' | 'architecture' | 'claude-md' | 'plan' | 'test-results'
  content: string
  createdAt: number
}

export interface SessionState {
  id: string
  projectName: string
  currentStage: Stage
  ideaText: string
  stackPrefs: string[]
  brainstormMd: string
  architectureMd: string
  claudeMd: string
  planMd: string
  projectPath: string
  checkpoints: Checkpoint[]
  createdAt: number
  updatedAt: number
}

export type PtyMode = 'plan' | 'auto' | 'normal'

// IPC Channel payload types
export interface IpcChannels {
  'session:create': {
    request: { projectName: string; ideaText: string; stackPrefs: string[]; projectPath: string }
    response: SessionState
  }
  'session:load': {
    request: { sessionId: string }
    response: SessionState | null
  }
  'session:list': {
    request: void
    response: Array<{ id: string; projectName: string; currentStage: Stage; updatedAt: number }>
  }
  'session:update-stage': {
    request: { sessionId: string; stage: Stage }
    response: void
  }
  'claude:brainstorm': {
    request: { ideaText: string; stackPrefs: string[] }
    response: void // streams via claude:brainstorm:chunk
  }
  'claude:brainstorm:chunk': {
    request: never
    response: { content: string; done: boolean }
  }
  'claude:generate-architecture': {
    request: { brainstormMd: string; stackPrefs: string[] }
    response: string
  }
  'claude:generate-claude-md': {
    request: { architectureMd: string; stack: string[] }
    response: string
  }
  'claude:generate-plan': {
    request: { claudeMd: string; architectureMd: string }
    response: string
  }
  'pty:spawn': {
    request: { projectPath: string; mode: PtyMode }
    response: void
  }
  'pty:write': {
    request: { data: string }
    response: void
  }
  'pty:kill': {
    request: void
    response: void
  }
  'terminal:data': {
    request: never
    response: string
  }
  'session:checkpoint': {
    request: never
    response: Checkpoint
  }
  'checkpoint:approve': {
    request: { checkpointId: string }
    response: void
  }
  'checkpoint:reject': {
    request: { checkpointId: string; feedback: string }
    response: void
  }
  'extension:search': {
    request: { query: string }
    response: Array<{ title: string; url: string; snippet: string }>
  }
  'artifact:save': {
    request: { sessionId: string; type: Artifact['type']; content: string }
    response: void
  }
  'artifact:load': {
    request: { sessionId: string; type: Artifact['type'] }
    response: string | null
  }
}
