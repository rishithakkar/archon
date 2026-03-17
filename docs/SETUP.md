# FlowForge Setup Guide

## Prerequisites

- **Node.js** 20+ (with npm 9+)
- **Claude Code** CLI installed and authenticated
- **Anthropic API key** set as `ANTHROPIC_API_KEY` environment variable
- **Visual Studio Build Tools** with "Desktop development with C++" workload (Windows only, needed for native modules)

## Installation

```bash
git clone <repo-url> flowforge
cd flowforge
npm install
```

### Rebuild native modules for Electron

```bash
cd apps/desktop
npm run rebuild
```

> **Note on Windows**: If you get a Spectre-mitigated libraries error during `node-pty` rebuild, install the "MSVC v143 Spectre-mitigated libs" component from Visual Studio Installer. The app will still work without node-pty using a child_process fallback.

## Development

```bash
npm run dev
```

This starts the Electron app with hot-reload for the renderer process.

## First Run

1. Launch the app with `npm run dev`
2. Enter a project name and describe your product idea
3. Select your preferred tech stack
4. Click "Start Brainstorming" to begin the guided flow
5. At each stage, review and approve before continuing

## Building for Distribution

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Installers are output to `apps/desktop/dist/`.

## Project Structure

See `CLAUDE.md` at the project root for full architecture documentation.

## Chrome Extension (not yet implemented)

The Chrome extension for web research is planned for a future release. The `extension:search` IPC channel is defined but not yet wired.
