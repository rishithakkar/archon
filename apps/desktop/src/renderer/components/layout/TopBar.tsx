import { useSessionStore } from '../../store/session'

export function TopBar() {
  const projectName = useSessionStore((s) => s.projectName)

  return (
    <div className="flex h-12 items-center justify-between border-b border-gray-800 bg-gray-950 px-4">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-purple-400">Archon</span>
      </div>

      <div className="text-sm text-gray-400">
        {projectName || 'No project'}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-green-500" title="Claude Code" />
          <span className="text-xs text-gray-500">Claude</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-gray-600" title="Extension" />
          <span className="text-xs text-gray-500">Extension</span>
        </div>
      </div>
    </div>
  )
}
