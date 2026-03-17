import { DiffEditor } from '@monaco-editor/react'

interface DiffViewerProps {
  original: string
  modified: string
  filename: string
  language?: string
}

export function DiffViewer({ original, modified, filename, language }: DiffViewerProps) {
  const addedLines = modified.split('\n').length - original.split('\n').length

  return (
    <div className="overflow-hidden rounded border border-gray-800">
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-3 py-2">
        <span className="text-sm font-medium text-gray-300">{filename}</span>
        <span className="text-xs text-gray-500">
          {addedLines >= 0 ? `+${addedLines}` : addedLines} lines
        </span>
      </div>
      <DiffEditor
        height="300px"
        original={original}
        modified={modified}
        language={language || 'typescript'}
        theme="vs-dark"
        options={{
          readOnly: true,
          renderSideBySide: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13
        }}
      />
    </div>
  )
}
