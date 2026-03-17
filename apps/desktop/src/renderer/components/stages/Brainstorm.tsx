import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { marked } from 'marked'
import { Stage } from '@archon/shared-types'
import { useSession } from '../../hooks/useSession'
import { useClaudeBridge } from '../../hooks/useClaudeBridge'
import { useSessionStore } from '../../store/session'

interface BrainstormVersion {
  id: number
  content: string
  feedback: string | null // user feedback that led to this version (null for v1)
  timestamp: number
}

export function Brainstorm() {
  const { brainstormMd, ideaText, updateBrainstorm, advanceStage, stackPrefs } = useSession()
  const { brainstorm, generateArchitecture, isLoading, streamingContent, error } = useClaudeBridge()
  const setError = useSessionStore((s) => s.setError)

  const [versions, setVersions] = useState<BrainstormVersion[]>([])
  const [activeVersionIndex, setActiveVersionIndex] = useState(0)
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0) // version selected for finalize
  const [feedbackInput, setFeedbackInput] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [refineStreaming, setRefineStreaming] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  // Load versions from saved artifact on mount
  useEffect(() => {
    const sessionId = useSessionStore.getState().id
    if (sessionId) {
      window.archon.artifact.load(sessionId, 'brainstorm-versions').then((saved) => {
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as BrainstormVersion[]
            if (parsed.length > 0) {
              setVersions(parsed)
              setActiveVersionIndex(parsed.length - 1)
              setSelectedVersionIndex(parsed.length - 1)
              // Set the latest version as brainstormMd
              updateBrainstorm(parsed[parsed.length - 1].content)
            }
          } catch {
            // If parsing fails, fall back to brainstormMd
          }
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When initial brainstorm completes (v1), add as first version
  useEffect(() => {
    if (brainstormMd && versions.length === 0) {
      const v1: BrainstormVersion = {
        id: 1,
        content: brainstormMd,
        feedback: null,
        timestamp: Date.now()
      }
      setVersions([v1])
      setActiveVersionIndex(0)
      setSelectedVersionIndex(0)
      persistVersions([v1])
    }
  }, [brainstormMd]) // eslint-disable-line react-hooks/exhaustive-deps

  const persistVersions = useCallback((vers: BrainstormVersion[]) => {
    const sessionId = useSessionStore.getState().id
    if (sessionId) {
      window.archon.artifact.save(sessionId, 'brainstorm-versions' as never, JSON.stringify(vers))
      // Also save the active version as the main brainstorm artifact
      if (vers.length > 0) {
        window.archon.artifact.save(sessionId, 'brainstorm', vers[vers.length - 1].content)
      }
    }
  }, [])

  const activeVersion = versions[activeVersionIndex] ?? null
  const selectedVersion = versions[selectedVersionIndex] ?? null

  const activeHtml = useMemo(() => {
    if (refineStreaming) return marked(refineStreaming) as string
    if (!activeVersion) return ''
    return marked(activeVersion.content) as string
  }, [activeVersion, refineStreaming])

  const handleRetry = async (): Promise<void> => {
    setError(null)
    await brainstorm(ideaText, stackPrefs)
  }

  const handleRequestRevision = useCallback(async () => {
    const feedback = feedbackInput.trim()
    if (!feedback || isRefining || isLoading || !activeVersion) return

    setFeedbackInput('')
    setIsRefining(true)
    setRefineStreaming('')

    let accumulatedContent = ''

    const unsubscribe = window.archon.onBrainstormChunk((chunk) => {
      if (chunk.done) {
        const finalContent = accumulatedContent
        if (finalContent) {
          const newVersion: BrainstormVersion = {
            id: versions.length + 1,
            content: finalContent,
            feedback,
            timestamp: Date.now()
          }
          const updatedVersions = [...versions, newVersion]
          setVersions(updatedVersions)
          setActiveVersionIndex(updatedVersions.length - 1)
          setSelectedVersionIndex(updatedVersions.length - 1)
          updateBrainstorm(finalContent)
          persistVersions(updatedVersions)
        }
        setRefineStreaming('')
        setIsRefining(false)
      } else {
        accumulatedContent += chunk.content
        setRefineStreaming(accumulatedContent)
      }
    })

    try {
      await window.archon.claude.refineBrainstorm(
        activeVersion.content,
        feedback,
        ideaText
      )
    } catch (err) {
      console.error('Refine failed:', err)
      setError(err instanceof Error ? err.message : 'Refinement failed. Try again.')
    } finally {
      setIsRefining(false)
      setRefineStreaming('')
      unsubscribe()
    }
  }, [feedbackInput, isRefining, isLoading, activeVersion, versions, ideaText, updateBrainstorm, persistVersions])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRequestRevision()
    }
  }

  const handleSelectVersion = (index: number) => {
    setActiveVersionIndex(index)
    setSelectedVersionIndex(index)
    updateBrainstorm(versions[index].content)
    contentRef.current?.scrollTo(0, 0)
  }

  const handleAdvance = async (): Promise<void> => {
    const content = selectedVersion?.content
    if (!content) return
    try {
      updateBrainstorm(content)
      await generateArchitecture(content, stackPrefs)
      await advanceStage(Stage.Architecture)
    } catch {
      // Error is set in useClaudeBridge
    }
  }

  const isStreaming = isLoading || isRefining
  const hasContent = versions.length > 0 || streamingContent

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3">
        <h2 className="text-2xl font-bold">Brainstorm</h2>
        <p className="mt-1 text-sm text-gray-400">
          {isLoading && versions.length === 0
            ? 'AI is brainstorming your idea...'
            : 'Review the brainstorm, request changes to create new versions, then select a version to finalize.'}
        </p>
      </div>

      {error && (
        <div className="mb-3 flex items-center justify-between rounded border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
          <span>{error}</span>
          <button
            onClick={handleRetry}
            className="ml-3 shrink-0 rounded bg-red-800 px-3 py-1 text-xs text-red-200 hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* No content state */}
      {!hasContent && !isStreaming && !error && (
        <div className="rounded border border-gray-700 bg-gray-800/50 p-6 text-center">
          <p className="mb-3 text-sm text-gray-400">
            No brainstorm content yet. Click below to start brainstorming.
          </p>
          <button
            onClick={handleRetry}
            className="rounded bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            Start Brainstorming
          </button>
        </div>
      )}

      {/* Version tabs + content */}
      {hasContent && (
        <>
          {/* Version tabs bar */}
          {versions.length > 0 && (
            <div className="mb-3 flex items-center gap-1 overflow-x-auto border-b border-gray-700 pb-2">
              <span className="mr-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Versions:</span>
              {versions.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => handleSelectVersion(i)}
                  className={`shrink-0 rounded-t px-3 py-1.5 text-xs font-medium transition-colors ${
                    i === activeVersionIndex
                      ? 'bg-purple-600 text-white'
                      : i === selectedVersionIndex
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                  }`}
                  title={v.feedback ? `Changes: ${v.feedback}` : 'Initial brainstorm'}
                >
                  v{v.id}
                </button>
              ))}
              {isRefining && (
                <span className="ml-1 flex items-center gap-1 text-xs text-purple-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
                  v{versions.length + 1}
                </span>
              )}
            </div>
          )}

          {/* Version feedback label */}
          {activeVersion?.feedback && (
            <div className="mb-2 rounded bg-gray-800/60 border border-gray-700/50 px-3 py-2 text-xs text-gray-400">
              <span className="font-medium text-gray-300">Your changes for this version:</span>{' '}
              {activeVersion.feedback}
            </div>
          )}

          {/* Content area */}
          <div
            ref={contentRef}
            className="mb-3 flex-1 overflow-y-auto rounded border border-gray-800 bg-gray-900/50 p-5"
          >
            {/* Initial streaming (v1 being generated) */}
            {streamingContent && versions.length === 0 && (
              <div
                className="prose prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: marked(streamingContent) as string }}
              />
            )}

            {/* Version content or refine streaming */}
            {(activeVersion || refineStreaming) && (
              <div
                className="prose prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: activeHtml }}
              />
            )}

            {/* Loading spinner for initial brainstorm */}
            {isLoading && !streamingContent && versions.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-purple-400">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                Generating brainstorm...
              </div>
            )}
          </div>

          {/* Revision input + finalize */}
          <div className="mt-auto space-y-3">
            {/* Selected version indicator */}
            {versions.length > 1 && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Selected for next stage:</span>
                <span className="rounded bg-purple-600/20 border border-purple-500/30 px-2 py-0.5 text-purple-300 font-medium">
                  Version {selectedVersionIndex + 1}
                </span>
              </div>
            )}

            {/* Feedback input */}
            <div className="flex gap-2">
              <textarea
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what to change (e.g., 'Remove collaboration features, keep it single-user')..."
                rows={2}
                disabled={isStreaming}
                className="flex-1 resize-none rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-purple-500 disabled:opacity-50"
              />
              <button
                onClick={handleRequestRevision}
                disabled={!feedbackInput.trim() || isStreaming}
                className="shrink-0 self-end rounded bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-50"
              >
                {isRefining ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                    Revising...
                  </span>
                ) : (
                  'Revise'
                )}
              </button>
            </div>

            <button
              onClick={handleAdvance}
              disabled={isStreaming || !selectedVersion}
              className="w-full rounded bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isLoading ? 'Generating Architecture...' : `Finalize v${selectedVersionIndex + 1} & Generate Architecture \u2192`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
