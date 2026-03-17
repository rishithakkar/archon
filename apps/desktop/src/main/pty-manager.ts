import { spawn, ChildProcess, execSync } from 'child_process'
import { BrowserWindow } from 'electron'
import { join } from 'path'
import type { PtyMode } from '@flowforge/shared-types'

let activeProcess: ChildProcess | null = null
let currentMode: PtyMode = 'normal'
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let detectedProjectPath: string | null = null
let spawnCwd: string = ''

function isClaudeInstalled(): boolean {
  try {
    const cmd = process.platform === 'win32' ? 'where claude' : 'which claude'
    execSync(cmd, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function sendToRenderers(data: string): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('terminal:data', data)
  })
}

function clearHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

/**
 * Parse stream-json output from Claude CLI and display it nicely in the terminal.
 * Each line is a JSON object with a "type" field.
 */
/**
 * Detect the actual project directory from file paths in tool_use events.
 * If Claude writes to D:/works/rishi/my-app/package.json and cwd is D:/works/rishi,
 * we detect "D:/works/rishi/my-app" as the project directory.
 */
function detectProjectPath(filePath: string): void {
  if (detectedProjectPath || !spawnCwd) return

  // Normalize paths for comparison
  const normalizedFile = filePath.replace(/\\/g, '/')
  const normalizedCwd = spawnCwd.replace(/\\/g, '/')

  // Check if file is inside cwd
  if (!normalizedFile.startsWith(normalizedCwd)) return

  // Get relative path from cwd
  const rel = normalizedFile.substring(normalizedCwd.length).replace(/^\//, '')
  const parts = rel.split('/')

  // If there's a subdirectory (e.g., "my-app/package.json"), the first part is the project
  if (parts.length >= 2) {
    detectedProjectPath = join(spawnCwd, parts[0])
    // Notify renderer
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('pty:project-path-detected', detectedProjectPath)
    })
    sendToRenderers(`\r\n\x1b[32m✓ Detected project directory: ${detectedProjectPath}\x1b[0m\r\n`)
  }
}

function parseStreamJson(rawData: string): void {
  const lines = rawData.split('\n').filter((l) => l.trim())
  for (const line of lines) {
    try {
      const event = JSON.parse(line)
      switch (event.type) {
        case 'system':
          if (event.subtype === 'init') {
            sendToRenderers(`\x1b[90mSession: ${event.session_id}\x1b[0m\r\n`)
            sendToRenderers(`\x1b[90mModel: ${event.model || 'claude'}\x1b[0m\r\n\r\n`)
          }
          break

        case 'assistant': {
          // Claude's text response
          const content = event.message?.content
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text' && block.text) {
                sendToRenderers(block.text.replace(/\n/g, '\r\n'))
              } else if (block.type === 'tool_use') {
                const name = block.name || 'tool'
                const input = block.input || {}
                sendToRenderers(`\r\n\x1b[36m🔧 ${name}\x1b[0m`)
                if (input.command) {
                  sendToRenderers(` \x1b[90m${input.command}\x1b[0m`)
                } else if (input.file_path) {
                  sendToRenderers(` \x1b[90m${input.file_path}\x1b[0m`)
                  // Auto-detect project directory from file paths
                  detectProjectPath(input.file_path)
                } else if (input.pattern) {
                  sendToRenderers(` \x1b[90m${input.pattern}\x1b[0m`)
                }
                sendToRenderers('\r\n')
              }
            }
          }
          // Reset heartbeat since we got real output
          clearHeartbeat()
          break
        }

        case 'tool': {
          // Tool result
          const content = event.content
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text' && block.text) {
                // Show truncated tool output
                const text = block.text
                const maxLen = 500
                if (text.length > maxLen) {
                  sendToRenderers(`\x1b[90m${text.substring(0, maxLen).replace(/\n/g, '\r\n')}...(truncated)\x1b[0m\r\n`)
                } else {
                  sendToRenderers(`\x1b[90m${text.replace(/\n/g, '\r\n')}\x1b[0m\r\n`)
                }
              }
            }
          }
          break
        }

        case 'result':
          sendToRenderers('\r\n\x1b[32m━━━ Execution Complete ━━━\x1b[0m\r\n')
          if (event.duration_ms) {
            const seconds = Math.round(event.duration_ms / 1000)
            sendToRenderers(`\x1b[90mDuration: ${seconds}s | Turns: ${event.num_turns || 1}\x1b[0m\r\n`)
          }
          if (event.result) {
            sendToRenderers('\r\n' + event.result.replace(/\n/g, '\r\n') + '\r\n')
          }
          break

        default:
          // Ignore other event types (rate_limit_event, etc.)
          break
      }
    } catch {
      // Not valid JSON — show as raw text
      if (line.trim()) {
        sendToRenderers(line + '\r\n')
      }
    }
  }
}

/**
 * Spawn Claude CLI in print mode (-p) with streaming JSON output.
 * Uses --output-format stream-json --verbose for real-time progress.
 * Uses --permission-mode auto so Claude auto-approves all tool use.
 */
export function spawnWithPrompt(projectPath: string, _mode: PtyMode, prompt: string): void {
  if (activeProcess) {
    killPty()
  }

  if (!isClaudeInstalled()) {
    sendToRenderers(
      '\r\n\x1b[33m⚠ Claude Code CLI is not installed or not in PATH.\x1b[0m\r\n' +
      '\r\nTo install it, run:\r\n' +
      '  \x1b[36mnpm install -g @anthropic-ai/claude-code\x1b[0m\r\n' +
      '\r\nThen restart the application.\r\n'
    )
    return
  }

  currentMode = 'auto'
  spawnCwd = projectPath
  detectedProjectPath = null

  sendToRenderers('\x1b[36m● Starting Claude Code CLI...\x1b[0m\r\n')
  sendToRenderers(`\x1b[90m  Project: ${projectPath}\x1b[0m\r\n`)
  sendToRenderers('\x1b[90m  This may take several minutes for large plans.\x1b[0m\r\n\r\n')

  const args = [
    '-p',                              // print/pipe mode
    '--permission-mode', 'auto',       // auto-approve all tool use prompts
    '--dangerously-skip-permissions',  // bypass directory write permission checks
    '--output-format', 'stream-json',  // stream JSON events for real-time output
    '--verbose'                        // required for stream-json
  ]

  activeProcess = spawn('claude', args, {
    cwd: projectPath,
    shell: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      TERM: 'xterm-256color'
    }
  })

  // Write prompt to stdin, then close it so Claude processes immediately
  if (activeProcess.stdin) {
    activeProcess.stdin.write(prompt)
    activeProcess.stdin.end()
  }

  // Parse streaming JSON from stdout
  activeProcess.stdout?.on('data', (data: Buffer) => {
    parseStreamJson(data.toString())
  })

  activeProcess.stderr?.on('data', (data: Buffer) => {
    sendToRenderers(data.toString())
  })

  // Heartbeat — show "still working" every 20 seconds if no output
  let heartbeatCount = 0
  heartbeatTimer = setInterval(() => {
    if (activeProcess) {
      heartbeatCount++
      const elapsed = heartbeatCount * 20
      sendToRenderers(`\x1b[90m  ⏳ Still working... (${elapsed}s elapsed)\x1b[0m\r\n`)
    } else {
      clearHeartbeat()
    }
  }, 20000)

  activeProcess.on('exit', (code) => {
    clearHeartbeat()
    if (code !== 0) {
      sendToRenderers(`\r\n\x1b[31m[Claude exited with code ${code}]\x1b[0m\r\n`)
    }
    activeProcess = null
  })

  activeProcess.on('error', (err) => {
    clearHeartbeat()
    sendToRenderers(`\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`)
    activeProcess = null
  })
}

/**
 * Spawn a shell command (npm test, git status, etc.)
 * stdin stays open so user can interact.
 */
export function spawnShell(projectPath: string, command: string): void {
  if (activeProcess) {
    killPty()
  }

  const isWin = process.platform === 'win32'

  sendToRenderers(`\x1b[90m$ ${command}\x1b[0m\r\n`)

  activeProcess = spawn(isWin ? 'cmd' : 'sh', isWin ? ['/c', command] : ['-c', command], {
    cwd: projectPath,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      TERM: 'xterm-256color'
    }
  })

  activeProcess.stdout?.on('data', (data: Buffer) => {
    sendToRenderers(data.toString())
  })

  activeProcess.stderr?.on('data', (data: Buffer) => {
    sendToRenderers(data.toString())
  })

  activeProcess.on('exit', (code) => {
    sendToRenderers(`\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`)
    activeProcess = null
  })

  activeProcess.on('error', (err) => {
    sendToRenderers(`\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`)
    activeProcess = null
  })
}

/**
 * Legacy interactive spawn.
 */
export function spawnPty(projectPath: string, mode: PtyMode): void {
  if (activeProcess) {
    killPty()
  }

  if (!isClaudeInstalled()) {
    sendToRenderers('\r\n\x1b[33m⚠ Claude Code CLI not found.\x1b[0m\r\n')
    return
  }

  currentMode = mode
  const isWin = process.platform === 'win32'
  const modeArgs = mode === 'plan'
    ? ['--permission-mode', 'plan']
    : mode === 'auto'
      ? ['--permission-mode', 'auto']
      : []
  const command = isWin ? 'cmd' : 'claude'
  const spawnArgs = isWin ? ['/c', 'claude', ...modeArgs] : modeArgs

  activeProcess = spawn(command, spawnArgs, {
    cwd: projectPath,
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      TERM: 'xterm-256color'
    }
  })

  activeProcess.stdout?.on('data', (data: Buffer) => {
    sendToRenderers(data.toString())
  })
  activeProcess.stderr?.on('data', (data: Buffer) => {
    sendToRenderers(data.toString())
  })
  activeProcess.on('exit', (code) => {
    sendToRenderers(`\r\n[Process exited with code ${code}]\r\n`)
    activeProcess = null
  })
  activeProcess.on('error', (err) => {
    sendToRenderers(`\r\n\x1b[31mError: ${err.message}\x1b[0m\r\n`)
    activeProcess = null
  })
}

export function writePty(data: string): void {
  if (activeProcess?.stdin?.writable) {
    activeProcess.stdin.write(data)
  }
}

export function killPty(): void {
  clearHeartbeat()
  if (activeProcess) {
    activeProcess.kill()
    activeProcess = null
  }
}

export function isPtyRunning(): boolean {
  return activeProcess !== null
}

export function getCurrentMode(): PtyMode {
  return currentMode
}

export function getDetectedProjectPath(): string | null {
  return detectedProjectPath
}
