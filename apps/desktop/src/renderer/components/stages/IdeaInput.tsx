import { useState } from 'react'
import { Stage } from '@archon/shared-types'
import { useSession } from '../../hooks/useSession'
import { useClaudeBridge } from '../../hooks/useClaudeBridge'

const STACK_OPTIONS = [
  'React', 'Next.js', 'Vue', 'Node.js', 'Python/FastAPI',
  'PostgreSQL', 'MongoDB', 'SQLite', 'Docker', 'Other'
]

export function IdeaInput() {
  const { createSession, advanceStage, ideaText, updateIdeaText, stackPrefs, updateStackPrefs } = useSession()
  const { brainstorm } = useClaudeBridge()
  const [projectName, setProjectName] = useState('')
  const [projectPath, setProjectPath] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState('')

  const toggleStack = (item: string): void => {
    const newPrefs = stackPrefs.includes(item)
      ? stackPrefs.filter((s) => s !== item)
      : [...stackPrefs, item]
    updateStackPrefs(newPrefs)
  }

  const handleStart = async (): Promise<void> => {
    if (!ideaText.trim() || !projectName.trim()) return

    setIsStarting(true)
    setError('')

    try {
      await createSession(projectName, ideaText, stackPrefs, projectPath || `./${projectName}`)
      await advanceStage(Stage.Brainstorm)
      // Fire and forget — brainstorm will stream into the Brainstorm component
      brainstorm(ideaText, stackPrefs).catch((err) => {
        console.error('Brainstorm failed:', err)
      })
    } catch (err) {
      console.error('Failed to start session:', err)
      setError(err instanceof Error ? err.message : 'Failed to create session. Check the console for details.')
      setIsStarting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Start with an idea</h2>
        <p className="mt-1 text-sm text-gray-400">
          Describe your product idea and we'll guide you through building it.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-300">Project name</label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="my-awesome-app"
          className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-300">Project path (optional)</label>
        <input
          type="text"
          value={projectPath}
          onChange={(e) => setProjectPath(e.target.value)}
          placeholder="./my-awesome-app"
          className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-300">
          Describe your product idea
        </label>
        <textarea
          value={ideaText}
          onChange={(e) => updateIdeaText(e.target.value)}
          placeholder="I want to build a..."
          rows={6}
          className="w-full resize-none rounded bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-300">Preferred stack</label>
        <div className="grid grid-cols-3 gap-2">
          {STACK_OPTIONS.map((item) => (
            <label
              key={item}
              className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                stackPrefs.includes(item)
                  ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              <input
                type="checkbox"
                checked={stackPrefs.includes(item)}
                onChange={() => toggleStack(item)}
                className="accent-purple-500"
              />
              {item}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={!ideaText.trim() || !projectName.trim() || isStarting}
        className="w-full rounded bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
      >
        {isStarting ? 'Starting...' : 'Start Brainstorming →'}
      </button>
    </div>
  )
}
