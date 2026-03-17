# Archon — Idea-to-Product Orchestrator

## What this is
A desktop app (Electron + React + TypeScript) that wraps Claude Code in a
step-by-step visual wizard. Users input a product idea and are guided through
brainstorming → architecture → code generation → testing → review, with a
live terminal panel and human-in-the-loop checkpoints at each stage.

## Stack
- **Desktop shell**: Electron 32, React 18, TypeScript 5
- **UI**: Tailwind CSS 3, Radix UI primitives
- **Build**: Vite + electron-vite
- **Main process bridge**: Node.js, node-pty (PTY spawn for Claude Code)
- **AI**: Anthropic SDK (@anthropic-ai/sdk) for brainstorm/plan generation
- **Storage**: better-sqlite3 (sessions, artifacts, history)
- **Chrome extension**: Manifest V3, native messaging to Electron main process
- **Testing**: Vitest (unit), Playwright (e2e)

## Monorepo structure
```
archon/
├── apps/
│   ├── desktop/          # Electron app
│   │   ├── src/
│   │   │   ├── main/     # Electron main process
│   │   │   │   ├── index.ts          # App entry, window creation
│   │   │   │   ├── ipc-handlers.ts   # All IPC channel handlers
│   │   │   │   ├── pty-manager.ts    # node-pty spawn + I/O streaming
│   │   │   │   ├── session-store.ts  # SQLite session persistence
│   │   │   │   └── claude-bridge.ts  # Anthropic SDK calls
│   │   │   ├── preload/
│   │   │   │   └── index.ts          # Contextbridge API exposure
│   │   │   └── renderer/             # React app
│   │   │       ├── App.tsx
│   │   │       ├── components/
│   │   │       │   ├── layout/
│   │   │       │   │   ├── Sidebar.tsx       # Stage nav
│   │   │       │   │   ├── TopBar.tsx        # Status indicators
│   │   │       │   │   └── TerminalPanel.tsx # xterm.js terminal
│   │   │       │   ├── stages/
│   │   │       │   │   ├── IdeaInput.tsx
│   │   │       │   │   ├── Brainstorm.tsx
│   │   │       │   │   ├── Architecture.tsx
│   │   │       │   │   ├── CodeGeneration.tsx
│   │   │       │   │   ├── Testing.tsx
│   │   │       │   │   └── Review.tsx
│   │   │       │   └── shared/
│   │   │       │       ├── HumanGate.tsx     # Checkpoint approval UI
│   │   │       │       ├── PlanViewer.tsx    # plan.md renderer
│   │   │       │       └── DiffViewer.tsx    # File diff display
│   │   │       ├── hooks/
│   │   │       │   ├── useSession.ts
│   │   │       │   ├── useTerminal.ts
│   │   │       │   └── useClaudeBridge.ts
│   │   │       └── store/
│   │   │           └── session.ts            # Zustand store
│   │   └── electron.vite.config.ts
│   └── extension/        # Chrome extension
│       ├── manifest.json
│       ├── background.ts
│       ├── content.ts
│       └── native-messaging/
│           └── host.ts
├── packages/
│   ├── shared-types/     # Types shared across apps
│   └── prompt-templates/ # Reusable Claude prompt templates
├── CLAUDE.md             # This file
├── package.json          # Workspace root
└── turbo.json
```

## Conventions
- All IPC channels are typed — define in `packages/shared-types/ipc.ts` first
- PTY output is streamed over `terminal:data` IPC channel to renderer
- Human-in-the-loop gates fire on `session:checkpoint` events
- Never call Anthropic API from renderer — always via IPC to main process
- Stage state lives in Zustand; session persistence in SQLite via main process
- All Claude prompts live in `packages/prompt-templates/` as exported strings
- Tailwind only — no inline styles except for dynamic values (e.g. progress %)
- Prefer Radix UI for interactive components (Dialog, Dropdown, Tabs)
- xterm.js for the terminal panel — attach to PTY stream via IPC

## Key IPC channels
```
session:create          → { projectName, ideaText }
session:load            → { sessionId }
claude:brainstorm       → { ideaText } → streams markdown
claude:generate-plan    → { brainstormMd, stack } → writes plan.md
pty:spawn               → { mode: 'plan' | 'auto' | 'normal' }
pty:write               → { data: string }
terminal:data           → streamed PTY output (main→renderer)
session:checkpoint      → { stage, description, diffSummary }
checkpoint:approve      → { checkpointId }
checkpoint:reject       → { checkpointId, feedback }
extension:search        → { query } → web research results
```

## Human-in-the-loop checkpoints
Checkpoints fire automatically at:
1. Before switching from Plan Mode → Auto-Accept Mode
2. Before writing auth/security-related files
3. Before running database migrations
4. After each major stage completes

The `HumanGate` component handles display. On approve, sends `checkpoint:approve`
IPC which resumes the PTY session.

## Prompt templates (in packages/prompt-templates/)
- `brainstorm.ts` — given idea text, returns features, user stories, tech considerations
- `architecture.ts` — given brainstorm output + stack prefs, returns architecture.md
- `claude-md-generator.ts` — generates a CLAUDE.md for the user's target project
- `plan-generator.ts` — generates plan.md with phased implementation steps

## DO NOT
- Call Anthropic API from renderer process (security)
- Store API keys in renderer or localStorage
- Auto-approve checkpoints without user interaction
- Run `rm -rf` or destructive shell commands without explicit user confirm
- Hardcode paths — use app.getPath('userData') for user data
