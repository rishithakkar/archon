import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { Stage } from '@flowforge/shared-types'
import type { SessionState, Checkpoint, Artifact } from '@flowforge/shared-types'
import { randomUUID } from 'crypto'

let db: Database.Database

export function initDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'flowforge.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      projectName TEXT NOT NULL,
      currentStage TEXT NOT NULL DEFAULT 'IdeaInput',
      ideaText TEXT NOT NULL DEFAULT '',
      stackPrefs TEXT NOT NULL DEFAULT '[]',
      projectPath TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      stage TEXT NOT NULL,
      description TEXT NOT NULL,
      diffSummary TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      feedback TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES sessions(id)
    );
  `)
}

export function createSession(params: {
  projectName: string
  ideaText: string
  stackPrefs: string[]
  projectPath: string
}): SessionState {
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO sessions (id, projectName, currentStage, ideaText, stackPrefs, projectPath, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, params.projectName, Stage.IdeaInput, params.ideaText, JSON.stringify(params.stackPrefs), params.projectPath, now, now)

  return {
    id,
    projectName: params.projectName,
    currentStage: Stage.IdeaInput,
    ideaText: params.ideaText,
    stackPrefs: params.stackPrefs,
    brainstormMd: '',
    architectureMd: '',
    claudeMd: '',
    planMd: '',
    projectPath: params.projectPath,
    checkpoints: [],
    createdAt: now,
    updatedAt: now
  }
}

export function loadSession(sessionId: string): SessionState | null {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as Record<string, unknown> | undefined
  if (!row) return null

  const checkpoints = db.prepare('SELECT * FROM checkpoints WHERE sessionId = ? ORDER BY createdAt')
    .all(sessionId) as Checkpoint[]

  const artifacts = db.prepare('SELECT * FROM artifacts WHERE sessionId = ?')
    .all(sessionId) as Artifact[]

  const findArtifact = (type: string): string =>
    (artifacts.find((a) => a.type === type)?.content) ?? ''

  return {
    id: row.id as string,
    projectName: row.projectName as string,
    currentStage: row.currentStage as Stage,
    ideaText: row.ideaText as string,
    stackPrefs: JSON.parse(row.stackPrefs as string),
    brainstormMd: findArtifact('brainstorm'),
    architectureMd: findArtifact('architecture'),
    claudeMd: findArtifact('claude-md'),
    planMd: findArtifact('plan'),
    projectPath: row.projectPath as string,
    checkpoints,
    createdAt: row.createdAt as number,
    updatedAt: row.updatedAt as number
  }
}

export function listSessions(): Array<{ id: string; projectName: string; currentStage: Stage; updatedAt: number }> {
  return db.prepare('SELECT id, projectName, currentStage, updatedAt FROM sessions ORDER BY updatedAt DESC')
    .all() as Array<{ id: string; projectName: string; currentStage: Stage; updatedAt: number }>
}

export function updateStage(sessionId: string, stage: Stage): void {
  db.prepare('UPDATE sessions SET currentStage = ?, updatedAt = ? WHERE id = ?')
    .run(stage, Date.now(), sessionId)
}

export function saveArtifact(sessionId: string, type: Artifact['type'], content: string): void {
  const existing = db.prepare('SELECT id FROM artifacts WHERE sessionId = ? AND type = ?').get(sessionId, type)

  if (existing) {
    db.prepare('UPDATE artifacts SET content = ?, createdAt = ? WHERE sessionId = ? AND type = ?')
      .run(content, Date.now(), sessionId, type)
  } else {
    db.prepare('INSERT INTO artifacts (id, sessionId, type, content, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), sessionId, type, content, Date.now())
  }
}

export function loadArtifact(sessionId: string, type: Artifact['type']): string | null {
  const row = db.prepare('SELECT content FROM artifacts WHERE sessionId = ? AND type = ?').get(sessionId, type) as { content: string } | undefined
  return row?.content ?? null
}

export function createCheckpoint(sessionId: string, checkpoint: Omit<Checkpoint, 'id' | 'createdAt'>): Checkpoint {
  const id = randomUUID()
  const createdAt = Date.now()

  db.prepare(`
    INSERT INTO checkpoints (id, sessionId, stage, description, diffSummary, status, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, sessionId, checkpoint.stage, checkpoint.description, checkpoint.diffSummary, checkpoint.status, createdAt)

  return { id, ...checkpoint, createdAt }
}

export function resolveCheckpoint(checkpointId: string, status: 'approved' | 'rejected', feedback?: string): void {
  db.prepare('UPDATE checkpoints SET status = ?, feedback = ? WHERE id = ?')
    .run(status, feedback ?? null, checkpointId)
}
