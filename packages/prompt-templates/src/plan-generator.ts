export const planGeneratorPrompt = (claudeMd: string, architectureMd: string): string => `
You are a senior developer creating an implementation plan. Given the CLAUDE.md and architecture
document below, generate a phased plan.md with concrete implementation steps.

CLAUDE.MD:
${claudeMd}

ARCHITECTURE:
${architectureMd}

Generate plan.md with these requirements:

1. Break the implementation into logical phases (e.g., Phase 1: Scaffold, Phase 2: Core Models, etc.)
2. Each phase should have a checklist of specific tasks using markdown checkboxes:
   - [ ] Task description — file path(s) involved
3. Tasks must be ordered so each phase builds on the previous
4. Every task must specify the exact file paths to create or modify
5. No ambiguity — Claude Code should execute this plan without asking questions
6. Include a final phase for testing and verification

Example format:
## Phase 1: Project Scaffold
- [ ] Initialize project with package.json — \`package.json\`
- [ ] Create folder structure — \`src/\`, \`src/models/\`, \`src/routes/\`

## Phase 2: Core Models
- [ ] Define User model — \`src/models/user.ts\`

Be thorough and specific. Every created file should be listed.
`
