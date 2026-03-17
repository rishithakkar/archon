interface PlanViewerProps {
  planMd: string
  completedItems?: Set<number>
  onItemToggle?: (index: number) => void
}

interface PlanItem {
  text: string
  checked: boolean
  index: number
}

interface PlanPhase {
  title: string
  items: PlanItem[]
}

function parsePlan(md: string): PlanPhase[] {
  const phases: PlanPhase[] = []
  let currentPhase: PlanPhase | null = null
  let itemIndex = 0

  for (const line of md.split('\n')) {
    const phaseMatch = line.match(/^##\s+(.+)/)
    if (phaseMatch) {
      currentPhase = { title: phaseMatch[1], items: [] }
      phases.push(currentPhase)
      continue
    }

    const itemMatch = line.match(/^- \[([ x])\]\s+(.+)/)
    if (itemMatch && currentPhase) {
      currentPhase.items.push({
        text: itemMatch[2],
        checked: itemMatch[1] === 'x',
        index: itemIndex++
      })
    }
  }

  return phases
}

export function PlanViewer({ planMd, completedItems, onItemToggle }: PlanViewerProps) {
  const phases = parsePlan(planMd)

  if (phases.length === 0) {
    return <div className="text-sm text-gray-500">No plan loaded</div>
  }

  return (
    <div className="space-y-4">
      {phases.map((phase) => (
        <div key={phase.title}>
          <h3 className="mb-2 text-sm font-semibold text-purple-400">{phase.title}</h3>
          <div className="space-y-1">
            {phase.items.map((item) => {
              const isComplete = completedItems?.has(item.index) || item.checked

              return (
                <label
                  key={item.index}
                  className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-gray-800/50"
                >
                  <input
                    type="checkbox"
                    checked={isComplete}
                    onChange={() => onItemToggle?.(item.index)}
                    className="mt-0.5 accent-purple-500"
                  />
                  <span className={`text-sm ${isComplete ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
                    {item.text}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
