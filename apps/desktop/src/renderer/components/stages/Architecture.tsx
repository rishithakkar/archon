import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { marked } from 'marked'
import { Stage } from '@flowforge/shared-types'
import { useSession } from '../../hooks/useSession'
import { useClaudeBridge } from '../../hooks/useClaudeBridge'
import { useSessionStore } from '../../store/session'

interface ArchVersion {
  id: number
  content: string
  feedback: string | null
  sectionName: string | null
  timestamp: number
}

interface ArchSection {
  title: string
  content: string
}

/** Parse architecture markdown into sections by ## headings, skipping # title */
function parseSections(md: string): ArchSection[] {
  const lines = md.split('\n')
  const sections: ArchSection[] = []
  let currentSection: ArchSection | null = null
  let preContent: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const h2Match = line.match(/^## (.+)/)
    if (h2Match) {
      if (currentSection) sections.push(currentSection)
      currentSection = { title: h2Match[1].trim(), content: '' }
    } else if (currentSection) {
      currentSection.content += (currentSection.content ? '\n' : '') + line
    } else {
      // Content before first ## — skip # titles, collect any real content
      if (!line.match(/^#\s/) && line.trim()) {
        preContent.push(line)
      }
    }
  }
  if (currentSection) sections.push(currentSection)

  // If there was meaningful content before the first ##, prepend as intro section
  if (preContent.length > 0) {
    sections.unshift({ title: 'Introduction', content: preContent.join('\n') })
  }

  return sections.filter((s) => s.content.trim().length > 0)
}

function SectionCard({
  section,
  isExpanded,
  onToggle,
  onRequestChange,
  disabled
}: {
  section: ArchSection
  isExpanded: boolean
  onToggle: () => void
  onRequestChange: (feedback: string) => void
  disabled: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [feedback, setFeedback] = useState('')
  const html = useMemo(() => marked(section.content) as string, [section.content])

  // Count items in section for preview
  const itemCount = section.content.split('\n').filter((l) => l.match(/^[-*]\s|^\d+\./)).length

  const handleSubmit = () => {
    const msg = feedback.trim()
    if (!msg) return
    onRequestChange(msg)
    setFeedback('')
    setEditing(false)
  }

  return (
    <div
      className={`rounded-lg border transition-all ${
        isExpanded
          ? 'border-purple-500/40 bg-gray-800/50'
          : 'border-gray-700/40 bg-gray-800/20 hover:border-gray-600 hover:bg-gray-800/40'
      }`}
    >
      {/* Section header — always visible */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-200">{section.title}</h3>
          {!isExpanded && itemCount > 0 && (
            <span className="text-[11px] text-gray-500">{itemCount} items</span>
          )}
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-700/30 px-4 py-4">
          <div
            className="prose prose-invert prose-sm max-w-none mb-4"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* Edit controls */}
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded bg-gray-700/50 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600 hover:text-white transition-colors disabled:opacity-40"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Request changes
            </button>
          ) : (
            <div className="space-y-2 rounded border border-gray-600/50 bg-gray-900/50 p-3">
              <label className="text-xs font-medium text-gray-400">
                What would you like to change in &quot;{section.title}&quot;?
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                  if (e.key === 'Escape') { setEditing(false); setFeedback('') }
                }}
                placeholder="e.g. 'Use SQLite instead of PostgreSQL' or 'Add a caching layer'"
                rows={2}
                autoFocus
                className="w-full resize-none rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-purple-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={!feedback.trim()}
                  className="rounded bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  Apply Changes
                </button>
                <button
                  onClick={() => { setEditing(false); setFeedback('') }}
                  className="rounded bg-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Architecture() {
  const { architectureMd, brainstormMd, updateArchitecture, stackPrefs, advanceStage } = useSession()
  const { generateArchitecture, generateClaudeMd, generatePlan, isLoading, error } = useClaudeBridge()
  const setError = useSessionStore((s) => s.setError)

  const [versions, setVersions] = useState<ArchVersion[]>([])
  const [activeVersionIndex, setActiveVersionIndex] = useState(0)
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0)
  const [isRefining, setIsRefining] = useState(false)
  const [refineStreaming, setRefineStreaming] = useState('')
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'sections' | 'full'>('sections')
  const [globalFeedback, setGlobalFeedback] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  // Load versions from artifact on mount
  useEffect(() => {
    const sessionId = useSessionStore.getState().id
    if (sessionId) {
      window.flowforge.artifact.load(sessionId, 'architecture-versions' as never).then((saved) => {
        if (saved) {
          try {
            const parsed = JSON.parse(saved) as ArchVersion[]
            if (parsed.length > 0) {
              setVersions(parsed)
              setActiveVersionIndex(parsed.length - 1)
              setSelectedVersionIndex(parsed.length - 1)
              updateArchitecture(parsed[parsed.length - 1].content)
            }
          } catch { /* fallback */ }
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When architecture is first generated, add as v1
  useEffect(() => {
    if (architectureMd && versions.length === 0) {
      const v1: ArchVersion = {
        id: 1,
        content: architectureMd,
        feedback: null,
        sectionName: null,
        timestamp: Date.now()
      }
      setVersions([v1])
      setActiveVersionIndex(0)
      setSelectedVersionIndex(0)
      persistVersions([v1])
    }
  }, [architectureMd]) // eslint-disable-line react-hooks/exhaustive-deps

  const persistVersions = useCallback((vers: ArchVersion[]) => {
    const sessionId = useSessionStore.getState().id
    if (sessionId) {
      window.flowforge.artifact.save(sessionId, 'architecture-versions' as never, JSON.stringify(vers))
      if (vers.length > 0) {
        window.flowforge.artifact.save(sessionId, 'architecture', vers[vers.length - 1].content)
      }
    }
  }, [])

  const activeVersion = versions[activeVersionIndex] ?? null
  const selectedVersion = versions[selectedVersionIndex] ?? null
  const displayContent = refineStreaming || activeVersion?.content || ''
  const sections = useMemo(() => parseSections(displayContent), [displayContent])

  const fullHtml = useMemo(() => {
    if (!displayContent) return ''
    return marked(displayContent) as string
  }, [displayContent])

  const handleRegenerate = async (): Promise<void> => {
    if (!brainstormMd) return
    setError(null)
    try {
      await generateArchitecture(brainstormMd, stackPrefs)
    } catch { /* error set in hook */ }
  }

  const handleRefine = useCallback(async (feedback: string, sectionName: string | null) => {
    if (!feedback.trim() || isRefining || isLoading || !activeVersion) return

    setIsRefining(true)
    setRefineStreaming('')
    setGlobalFeedback('')

    let accumulatedContent = ''

    const unsubscribe = window.flowforge.onArchitectureChunk((chunk) => {
      if (chunk.done) {
        const finalContent = accumulatedContent
        if (finalContent) {
          const newVersion: ArchVersion = {
            id: versions.length + 1,
            content: finalContent,
            feedback,
            sectionName,
            timestamp: Date.now()
          }
          const updatedVersions = [...versions, newVersion]
          setVersions(updatedVersions)
          setActiveVersionIndex(updatedVersions.length - 1)
          setSelectedVersionIndex(updatedVersions.length - 1)
          updateArchitecture(finalContent)
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
      await window.flowforge.claude.refineArchitecture(
        activeVersion.content,
        feedback,
        sectionName
      )
    } catch (err) {
      console.error('Architecture refine failed:', err)
      setError(err instanceof Error ? err.message : 'Refinement failed. Try again.')
    } finally {
      setIsRefining(false)
      setRefineStreaming('')
      unsubscribe()
    }
  }, [isRefining, isLoading, activeVersion, versions, updateArchitecture, persistVersions])

  const handleSelectVersion = (index: number) => {
    setActiveVersionIndex(index)
    setSelectedVersionIndex(index)
    updateArchitecture(versions[index].content)
    setExpandedSection(null)
    contentRef.current?.scrollTo(0, 0)
  }

  const handleGeneratePlan = async (): Promise<void> => {
    const content = selectedVersion?.content
    if (!content) return
    try {
      updateArchitecture(content)
      const claudeMd = await generateClaudeMd(content, stackPrefs)
      await generatePlan(claudeMd, content)
      await advanceStage(Stage.CodeGeneration)
    } catch { /* error set in hook */ }
  }

  const isStreaming = isLoading || isRefining
  const hasContent = versions.length > 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 shrink-0">
        <h2 className="text-2xl font-bold">Architecture</h2>
        <p className="mt-1 text-sm text-gray-400">
          {isLoading && !hasContent
            ? 'Generating architecture...'
            : 'Review each section. Click to expand and request changes.'}
        </p>
      </div>

      {error && (
        <div className="mb-3 shrink-0 flex items-center justify-between rounded border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
          <span>{error}</span>
          <button onClick={handleRegenerate} className="ml-3 shrink-0 rounded bg-red-800 px-3 py-1 text-xs text-red-200 hover:bg-red-700">
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!hasContent && !isStreaming && !error && (
        <div className="rounded border border-gray-700 bg-gray-800/50 p-6 text-center">
          <p className="mb-3 text-sm text-gray-400">No architecture yet. Generate from brainstorm.</p>
          <button onClick={handleRegenerate} disabled={!brainstormMd} className="rounded bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
            Generate Architecture
          </button>
        </div>
      )}

      {/* Loading for initial gen */}
      {isLoading && !hasContent && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-purple-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
            Generating architecture from brainstorm...
          </div>
        </div>
      )}

      {/* Main content area */}
      {hasContent && (
        <>
          {/* Version bar + view toggle */}
          <div className="mb-2 shrink-0 flex items-center justify-between gap-4">
            {/* Version tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              <span className="mr-1 text-xs font-medium text-gray-500 uppercase tracking-wider">Versions:</span>
              {versions.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => handleSelectVersion(i)}
                  title={v.feedback ? `${v.sectionName ? `[${v.sectionName}] ` : ''}${v.feedback}` : 'Initial architecture'}
                  className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    i === activeVersionIndex
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                  }`}
                >
                  v{v.id}
                  {v.sectionName && <span className="ml-1 text-[10px] opacity-60">({v.sectionName})</span>}
                </button>
              ))}
              {isRefining && (
                <span className="ml-1 flex items-center gap-1 text-xs text-purple-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
                  v{versions.length + 1}
                </span>
              )}
            </div>

            {/* View toggle */}
            <div className="flex shrink-0 rounded border border-gray-700 bg-gray-800/50">
              <button
                onClick={() => setViewMode('sections')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'sections' ? 'bg-purple-600 text-white rounded-l' : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Sections
              </button>
              <button
                onClick={() => setViewMode('full')}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  viewMode === 'full' ? 'bg-purple-600 text-white rounded-r' : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Full Doc
              </button>
            </div>
          </div>

          {/* Version change label */}
          {activeVersion?.feedback && (
            <div className="mb-2 shrink-0 rounded bg-gray-800/60 border border-gray-700/50 px-3 py-1.5 text-xs text-gray-400">
              <span className="font-medium text-gray-300">
                Changes{activeVersion.sectionName ? ` to ${activeVersion.sectionName}` : ''}:
              </span>{' '}
              {activeVersion.feedback}
            </div>
          )}

          {/* Content — scrollable */}
          <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto mb-3">
            {viewMode === 'sections' ? (
              isRefining ? (
                <div className="rounded-lg border border-purple-500/30 bg-gray-800/30 p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs text-purple-400">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                    Generating revised architecture...
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: fullHtml }} />
                </div>
              ) : (
                <div className="space-y-2">
                  {sections.map((section, i) => (
                    <SectionCard
                      key={section.title + i}
                      section={section}
                      isExpanded={expandedSection === section.title}
                      onToggle={() => setExpandedSection(expandedSection === section.title ? null : section.title)}
                      onRequestChange={(fb) => handleRefine(fb, section.title)}
                      disabled={isStreaming}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="rounded border border-gray-800 bg-gray-900/50 p-5">
                <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: fullHtml }} />
              </div>
            )}
          </div>

          {/* Bottom controls — always pinned */}
          <div className="shrink-0 space-y-2 pt-2 border-t border-gray-800">
            {versions.length > 1 && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Selected for next stage:</span>
                <span className="rounded bg-purple-600/20 border border-purple-500/30 px-2 py-0.5 text-purple-300 font-medium">
                  Version {selectedVersionIndex + 1}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <textarea
                value={globalFeedback}
                onChange={(e) => setGlobalFeedback(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    const msg = globalFeedback.trim()
                    if (msg) handleRefine(msg, null)
                  }
                }}
                placeholder="Describe overall changes (or click a section above for targeted edits)..."
                rows={2}
                disabled={isStreaming}
                className="flex-1 resize-none rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-purple-500 disabled:opacity-50"
              />
              <button
                onClick={() => { const msg = globalFeedback.trim(); if (msg) handleRefine(msg, null) }}
                disabled={!globalFeedback.trim() || isStreaming}
                className="shrink-0 self-end rounded bg-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-600 disabled:opacity-50"
              >
                {isRefining ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
                    Revising...
                  </span>
                ) : 'Revise'}
              </button>
            </div>

            <button
              onClick={handleGeneratePlan}
              disabled={isStreaming || !selectedVersion}
              className="w-full rounded bg-purple-600 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {isLoading ? 'Generating...' : `Finalize v${selectedVersionIndex + 1} & Generate Plan \u2192`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
