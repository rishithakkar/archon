export const brainstormPrompt = (ideaText: string, _stack?: string[]): string => `
The user has a product idea they want to brainstorm. Help them think through it at a HIGH LEVEL — focus on the WHAT and WHY, not the HOW.

IDEA: "${ideaText}"

Produce a structured brainstorm covering:

## 🎯 Core Concept
What is this product? Who is it for? What problem does it solve?

## ✅ MVP Features (must-have for v1)
List the essential features needed to make this useful. Keep it minimal.

## 🚀 Future Features (v2+)
Nice-to-haves that can come later.

## 👤 User Stories (top 5)
"As a [user], I want to [action] so that [benefit]"

## ⚠️ Risks & Open Questions
What could go wrong? What needs more thought?

IMPORTANT RULES:
- Do NOT discuss technology stack, frameworks, databases, or architecture. That comes in the next stage.
- Do NOT suggest specific libraries, languages, or deployment strategies.
- Focus purely on the PRODUCT — features, user experience, scope, and priorities.
- Keep it concise and actionable.
- End by asking the user 2-3 clarifying questions to help refine the idea.
- Mention that when they're happy with the brainstorm, they can click "Finalize & Generate Architecture" to move to the next stage.
`
