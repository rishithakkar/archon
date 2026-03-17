import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { Checkpoint } from '@flowforge/shared-types'

interface HumanGateProps {
  checkpoint: Checkpoint
  onApprove: (checkpointId: string) => void
  onReject: (checkpointId: string, feedback: string) => void
}

export function HumanGate({ checkpoint, onApprove, onReject }: HumanGateProps) {
  const [feedback, setFeedback] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-amber-600/30 bg-gray-900 p-6 shadow-xl">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <Dialog.Title className="text-lg font-semibold text-amber-400">
              Checkpoint — Review Required
            </Dialog.Title>
          </div>

          <Dialog.Description className="mb-3 text-sm text-gray-300">
            {checkpoint.description}
          </Dialog.Description>

          {checkpoint.diffSummary && (
            <div className="mb-4 rounded bg-gray-800 p-3">
              <div className="mb-1 text-xs font-medium text-gray-500">Changes</div>
              <pre className="whitespace-pre-wrap text-xs text-gray-300">
                {checkpoint.diffSummary}
              </pre>
            </div>
          )}

          <div className="mb-1 text-xs text-gray-500">
            Stage: {checkpoint.stage}
          </div>

          {showFeedback && (
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Describe what should change..."
              className="mt-3 w-full rounded bg-gray-800 p-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:ring-1 focus:ring-amber-500"
              rows={3}
            />
          )}

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => onApprove(checkpoint.id)}
              className="flex-1 rounded bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Approve
            </button>
            {showFeedback ? (
              <button
                onClick={() => onReject(checkpoint.id, feedback)}
                disabled={!feedback.trim()}
                className="flex-1 rounded bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject with Feedback
              </button>
            ) : (
              <button
                onClick={() => setShowFeedback(true)}
                className="flex-1 rounded bg-red-600/20 py-2 text-sm font-medium text-red-400 hover:bg-red-600/30"
              >
                Reject
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
