import Anthropic from '@anthropic-ai/sdk'
import {
  brainstormPrompt,
  architecturePrompt,
  claudeMdPrompt,
  planGeneratorPrompt
} from '@archon/prompt-templates'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic()
  }
  return client
}

const MODEL = 'claude-sonnet-4-20250514'

const BRAINSTORM_SYSTEM = `You are a product brainstorming partner. Your job is to help the user refine their PRODUCT IDEA — the what, why, and for whom.

RULES YOU MUST FOLLOW:
- Focus ONLY on: features, user experience, scope, target audience, priorities, and use cases.
- NEVER discuss technology stack, frameworks, databases, architecture, deployment, or implementation details. If the user asks about tech, say "Great question! We'll cover that in the Architecture stage. For now, let's nail down the product scope."
- Keep responses concise (under 300 words unless the user asks for detail).
- Be collaborative — ask follow-up questions, challenge assumptions, suggest alternatives.
- Use markdown formatting with clear headings and bullet points.
- When the conversation feels complete, remind the user they can click "Finalize & Generate Architecture" to proceed to the next stage.

You are in the BRAINSTORM stage of a multi-stage product development wizard. Architecture, code generation, and testing happen in later stages — stay in your lane.`

export async function streamBrainstorm(
  ideaText: string,
  stackPrefs: string[],
  onChunk: (content: string, done: boolean) => void
): Promise<void> {
  const prompt = brainstormPrompt(ideaText, stackPrefs)

  try {
    const stream = getClient().messages.stream({
      model: MODEL,
      max_tokens: 2048,
      system: BRAINSTORM_SYSTEM,
      messages: [{ role: 'user', content: prompt }]
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onChunk(event.delta.text, false)
      }
    }
    onChunk('', true)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Brainstorm failed'
    console.error('streamBrainstorm error:', msg)
    onChunk('', true) // Always signal done so UI doesn't get stuck
    throw err
  }
}

export async function streamRefineBrainstorm(
  currentVersion: string,
  userFeedback: string,
  ideaText: string,
  onChunk: (content: string, done: boolean) => void
): Promise<void> {
  const REFINE_SYSTEM = `You are a product brainstorming partner. The user has an existing brainstorm document and wants to refine it based on their feedback.

RULES:
- Output a COMPLETE, UPDATED brainstorm document — not a diff or commentary.
- Incorporate the user's feedback into the existing brainstorm structure.
- Keep the same markdown format with headings and bullet points.
- Focus ONLY on product features, scope, user stories, priorities — NO tech stack or architecture.
- If the user's feedback conflicts with the existing brainstorm, prioritize the user's feedback.
- Do NOT add commentary like "Here's the updated version" — just output the updated brainstorm directly.`

  try {
    const stream = getClient().messages.stream({
      model: MODEL,
      max_tokens: 2048,
      system: REFINE_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Original idea: "${ideaText}"

Current brainstorm (Version to refine):
${currentVersion}

User's requested changes:
${userFeedback}

Generate the complete updated brainstorm document incorporating the user's changes.`
        }
      ]
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onChunk(event.delta.text, false)
      }
    }
    onChunk('', true)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Refine brainstorm failed'
    console.error('streamRefineBrainstorm error:', msg)
    onChunk('', true)
    throw err
  }
}

export async function generateArchitecture(
  brainstormMd: string,
  stackPrefs: string[]
): Promise<string> {
  const prompt = architecturePrompt(brainstormMd, stackPrefs)

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  })

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

export async function streamRefineArchitecture(
  currentVersion: string,
  userFeedback: string,
  sectionName: string | null,
  onChunk: (content: string, done: boolean) => void
): Promise<void> {
  const sectionContext = sectionName
    ? `\nThe user specifically wants to change the "${sectionName}" section. Focus your changes there but update other sections if the change impacts them.`
    : ''

  const REFINE_ARCH_SYSTEM = `You are a senior software architect. The user has an existing architecture document and wants to refine it.

RULES:
- Output the COMPLETE, UPDATED architecture document — not a diff or commentary.
- Incorporate the user's feedback into the existing structure.
- Keep the same markdown format with all original sections.
- Be specific and actionable — every endpoint, model, and file path should be concrete.
- Do NOT add commentary like "Here's the updated version" — just output the updated document directly.
- Maintain consistency across sections (if you change a data model, update related API endpoints too).${sectionContext}`

  try {
    const stream = getClient().messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: REFINE_ARCH_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Current architecture document:
${currentVersion}

User's requested changes:
${userFeedback}

Generate the complete updated architecture document incorporating the user's changes.`
        }
      ]
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        onChunk(event.delta.text, false)
      }
    }
    onChunk('', true)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Refine architecture failed'
    console.error('streamRefineArchitecture error:', msg)
    onChunk('', true)
    throw err
  }
}

export async function generateClaudeMd(
  architectureMd: string,
  stack: string[]
): Promise<string> {
  const prompt = claudeMdPrompt(architectureMd, stack)

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  })

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

export async function generatePlan(
  claudeMd: string,
  architectureMd: string
): Promise<string> {
  const prompt = planGeneratorPrompt(claudeMd, architectureMd)

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }]
  })

  return response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
}
