export const architecturePrompt = (brainstormMd: string, stackPrefs: string[]): string => `
You are a senior software architect. Based on the brainstorm output below, produce a detailed architecture document.

BRAINSTORM OUTPUT:
${brainstormMd}

PREFERRED STACK: ${stackPrefs.join(', ')}

Produce architecture.md with these sections:

## System Overview
Brief description of the system and its purpose.

## System Components
List each component/service with:
- Name
- Responsibility
- Key interfaces

## Data Models
Define entities and their relationships. Use TypeScript-style interfaces.

## API Surface
Key endpoints with method, path, request/response shapes.

## Folder Structure
Recommended project folder structure with descriptions.

## Tech Decisions
For each technology choice, provide:
- What was chosen
- Why it was chosen over alternatives
- Any trade-offs

Be concrete and specific. Every file path and endpoint should be actionable.
`
