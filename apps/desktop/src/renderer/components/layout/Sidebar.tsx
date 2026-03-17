import { Stage } from '@flowforge/shared-types'
import { useSessionStore } from '../../store/session'

const STAGES: { stage: Stage; label: string; number: number }[] = [
  { stage: Stage.IdeaInput, label: 'Idea Input', number: 1 },
  { stage: Stage.Brainstorm, label: 'Brainstorm', number: 2 },
  { stage: Stage.Architecture, label: 'Architecture', number: 3 },
  { stage: Stage.CodeGeneration, label: 'Code Generation', number: 4 },
  { stage: Stage.Testing, label: 'Testing', number: 5 },
  { stage: Stage.Review, label: 'Review', number: 6 }
]

const STAGE_ORDER = Object.values(Stage)

function getStageStatus(
  stage: Stage,
  currentStage: Stage,
  highestStage: Stage
): 'done' | 'active' | 'reachable' | 'idle' {
  const stageIdx = STAGE_ORDER.indexOf(stage)
  const currentIdx = STAGE_ORDER.indexOf(currentStage)
  const highestIdx = STAGE_ORDER.indexOf(highestStage)

  if (stageIdx === currentIdx) return 'active'
  if (stageIdx < highestIdx) return 'done'
  if (stageIdx === highestIdx && stageIdx !== currentIdx) return 'reachable'
  return 'idle'
}

interface SidebarProps {
  onExitSession?: () => void
}

export function Sidebar({ onExitSession }: SidebarProps) {
  const currentStage = useSessionStore((s) => s.currentStage)
  const highestStage = useSessionStore((s) => s.highestStage)
  const navigateTo = useSessionStore((s) => s.navigateTo)
  const projectName = useSessionStore((s) => s.projectName)
  const sessionId = useSessionStore((s) => s.id)

  return (
    <div className="flex h-full w-[220px] flex-col border-r border-gray-800 bg-gray-950">
      <div className="flex-1 py-4">
        {STAGES.map(({ stage, label, number }) => {
          const status = getStageStatus(stage, currentStage, highestStage)
          const isClickable = status !== 'idle'

          return (
            <button
              key={stage}
              onClick={() => isClickable && navigateTo(stage)}
              disabled={!isClickable}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                status === 'active'
                  ? 'border-r-2 border-purple-500 bg-gray-900/50 text-white'
                  : status === 'done'
                    ? 'text-gray-300 hover:bg-gray-900/30'
                    : status === 'reachable'
                      ? 'text-gray-300 hover:bg-gray-900/30'
                      : 'cursor-not-allowed text-gray-600'
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  status === 'done'
                    ? 'bg-green-600 text-white'
                    : status === 'active'
                      ? 'bg-purple-600 text-white'
                      : status === 'reachable'
                        ? 'border border-purple-500 text-purple-400'
                        : 'border border-gray-600 text-gray-600'
                }`}
              >
                {status === 'done' ? '✓' : number}
              </div>
              <span className="text-sm">{label}</span>
            </button>
          )
        })}
      </div>

      <div className="border-t border-gray-800 p-4">
        <div className="mb-2 text-xs text-gray-500">
          {projectName ? `Project: ${projectName}` : 'No active session'}
        </div>
        {sessionId && onExitSession && (
          <button
            onClick={onExitSession}
            className="w-full rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-gray-600 hover:bg-gray-800 hover:text-gray-300"
          >
            Switch Session
          </button>
        )}
      </div>
    </div>
  )
}
