export const claudeMdPrompt = (architectureMd: string, stack: string[]): string => `
You are an expert developer. Generate a CLAUDE.md file for a project based on this architecture.

ARCHITECTURE:
${architectureMd}

STACK: ${stack.join(', ')}

The CLAUDE.md should follow this structure:

# Project Name

## What this is
One paragraph description.

## Stack
Bullet list of technologies with versions.

## Project structure
\`\`\`
folder tree with descriptions
\`\`\`

## Conventions
- Coding conventions
- File naming patterns
- Import ordering rules

## Key patterns
Describe important architectural patterns used.

## DO NOT
List of things to avoid.

Make the CLAUDE.md specific to this project. It should give Claude Code enough context
to work autonomously within the codebase without asking questions.
`
