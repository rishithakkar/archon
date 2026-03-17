import { ipcMain, BrowserWindow } from 'electron'
import * as sessionStore from './session-store'
import * as ptyManager from './pty-manager'
import * as claudeBridge from './claude-bridge'
import type { Stage } from '@flowforge/shared-types'
import type { Artifact } from '@flowforge/shared-types'

export function registerIpcHandlers(): void {
  // Session handlers
  ipcMain.handle('session:create', async (_event, params: {
    projectName: string
    ideaText: string
    stackPrefs: string[]
    projectPath: string
  }) => {
    return sessionStore.createSession(params)
  })

  ipcMain.handle('session:load', async (_event, params: { sessionId: string }) => {
    return sessionStore.loadSession(params.sessionId)
  })

  ipcMain.handle('session:list', async () => {
    return sessionStore.listSessions()
  })

  ipcMain.handle('session:update-stage', async (_event, params: { sessionId: string; stage: Stage }) => {
    sessionStore.updateStage(params.sessionId, params.stage)
  })

  // Claude bridge handlers
  ipcMain.handle('claude:brainstorm', async (event, params: { ideaText: string; stackPrefs: string[] }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    await claudeBridge.streamBrainstorm(
      params.ideaText,
      params.stackPrefs,
      (content, done) => {
        win?.webContents.send('claude:brainstorm:chunk', { content, done })
      }
    )
  })

  ipcMain.handle('claude:refine-brainstorm', async (event, params: {
    currentVersion: string
    userFeedback: string
    ideaText: string
  }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    await claudeBridge.streamRefineBrainstorm(
      params.currentVersion,
      params.userFeedback,
      params.ideaText,
      (content, done) => {
        win?.webContents.send('claude:brainstorm:chunk', { content, done })
      }
    )
  })

  ipcMain.handle('claude:generate-architecture', async (_event, params: { brainstormMd: string; stackPrefs: string[] }) => {
    return claudeBridge.generateArchitecture(params.brainstormMd, params.stackPrefs)
  })

  ipcMain.handle('claude:refine-architecture', async (event, params: {
    currentVersion: string
    userFeedback: string
    sectionName: string | null
  }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    await claudeBridge.streamRefineArchitecture(
      params.currentVersion,
      params.userFeedback,
      params.sectionName,
      (content, done) => {
        win?.webContents.send('claude:architecture:chunk', { content, done })
      }
    )
  })

  ipcMain.handle('claude:generate-claude-md', async (_event, params: { architectureMd: string; stack: string[] }) => {
    return claudeBridge.generateClaudeMd(params.architectureMd, params.stack)
  })

  ipcMain.handle('claude:generate-plan', async (_event, params: { claudeMd: string; architectureMd: string }) => {
    return claudeBridge.generatePlan(params.claudeMd, params.architectureMd)
  })

  // PTY handlers
  ipcMain.handle('pty:spawn', async (_event, params: { projectPath: string; mode: 'plan' | 'auto' | 'normal' }) => {
    ptyManager.spawnPty(params.projectPath, params.mode)
  })

  ipcMain.handle('pty:spawn-with-prompt', async (_event, params: { projectPath: string; mode: 'plan' | 'auto' | 'normal'; prompt: string }) => {
    ptyManager.spawnWithPrompt(params.projectPath, params.mode, params.prompt)
  })

  ipcMain.handle('pty:spawn-shell', async (_event, params: { projectPath: string; command: string }) => {
    ptyManager.spawnShell(params.projectPath, params.command)
  })

  ipcMain.on('pty:write', (_event, params: { data: string }) => {
    ptyManager.writePty(params.data)
  })

  ipcMain.handle('pty:kill', async () => {
    ptyManager.killPty()
  })

  // Checkpoint handlers
  ipcMain.handle('checkpoint:approve', async (_event, params: { checkpointId: string }) => {
    sessionStore.resolveCheckpoint(params.checkpointId, 'approved')
    // Resume PTY if it was waiting
    ptyManager.writePty('\n')
  })

  ipcMain.handle('checkpoint:reject', async (_event, params: { checkpointId: string; feedback: string }) => {
    sessionStore.resolveCheckpoint(params.checkpointId, 'rejected', params.feedback)
  })

  // Artifact handlers
  ipcMain.handle('artifact:save', async (_event, params: { sessionId: string; type: Artifact['type']; content: string }) => {
    sessionStore.saveArtifact(params.sessionId, params.type, params.content)
  })

  ipcMain.handle('artifact:load', async (_event, params: { sessionId: string; type: Artifact['type'] }) => {
    return sessionStore.loadArtifact(params.sessionId, params.type)
  })
}
