import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { PersonaSelector } from "@/components/PersonaSelector"
import { SectionPanel } from "@/components/SectionPanel"
import { RefinementPanel } from "@/components/RefinementPanel"
import { ScoreRow } from "@/components/ScoreBadge"
import { useExploration } from "@/hooks/useExploration"
import type { Persona } from "@/lib/persona"
import {
  Plus,
  History,
  ArrowLeft,
  Send,
  Compass,
  ArrowRight,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react"

export function ExploreView() {
  const {
    session,
    currentStep,
    allSections,
    isLoading,
    error,
    personaId,
    setPersonaId,
    startExploration,
    selectBranch,
    sessionList,
    loadSession,
    removeSession,
    reset,
    refreshList,
    // Refinement
    pending,
    isScoring,
    isRefining,
    personaPaths,
    isLoadingPaths,
    previewBranch,
    scoreAndRefine,
    refinePrompt,
    selectRefinement,
    commitExploration,
    cancelRefinement,
  } = useExploration()

  const [prompt, setPrompt] = React.useState("")
  const [showHistory, setShowHistory] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    const trimmed = prompt.trim()
    if (!trimmed || isLoading) return
    startExploration(trimmed)
    setPrompt("")
  }

  const handleScoreAndRefine = () => {
    const trimmed = prompt.trim()
    if (!trimmed || isLoading || isScoring) return
    scoreAndRefine(trimmed)
    setPrompt("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handlePersonaSelect = (persona: Persona | null) => {
    setPersonaId(persona?.id ?? null)
  }

  const handleNewSession = () => {
    reset()
    setShowHistory(false)
    setPrompt("")
    textareaRef.current?.focus()
  }

  const handleToggleHistory = () => {
    if (!showHistory) refreshList()
    setShowHistory(!showHistory)
  }

  const hasContent = session && session.steps.length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleHistory}
          className="gap-1.5"
        >
          {showHistory ? <ArrowLeft className="h-4 w-4" /> : <History className="h-4 w-4" />}
          {showHistory ? "Back" : "History"}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleNewSession} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New
        </Button>
        <div className="flex-1 text-center">
          {session && (
            <span className="text-sm font-medium text-muted-foreground truncate">
              {session.title}
            </span>
          )}
        </div>
        <PersonaSelector selectedId={personaId} onSelect={handlePersonaSelect} />
      </div>

      {/* Main content area */}
      {showHistory ? (
        <HistoryList
          sessions={sessionList}
          activeId={session?.id ?? null}
          onSelect={(id) => {
            loadSession(id)
            setShowHistory(false)
          }}
          onDelete={removeSession}
        />
      ) : pending ? (
        /* Refinement mode */
        <RefinementPanel
          pending={pending}
          personaPaths={personaPaths}
          isLoadingPaths={isLoadingPaths}
          isRefining={isRefining}
          isLoading={isLoading}
          onRefine={refinePrompt}
          onSelectRefinement={selectRefinement}
          onCommit={commitExploration}
          onCancel={cancelRefinement}
        />
      ) : hasContent ? (
        <div className="flex-1 min-h-0 flex">
          {/* Left: Section cards */}
          <div className="flex-1 min-w-0 border-r border-border">
            <SectionPanel sections={allSections} isLoading={isLoading} />
          </div>

          {/* Right: Branch paths */}
          <div className="w-80 shrink-0 flex flex-col">
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Compass className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Paths to Explore
                  </span>
                </div>

                {isLoading ? (
                  [1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader className="pb-2">
                        <Skeleton className="h-4 w-28" />
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/4 mt-1" />
                      </CardContent>
                    </Card>
                  ))
                ) : currentStep?.branches.length ? (
                  currentStep.branches.map((branch) => (
                    <Card
                      key={branch.id}
                      className="hover:border-green-600/50 hover:bg-green-600/5 transition-colors group"
                    >
                      <CardHeader className="pb-1.5 pt-3 px-4">
                        <CardTitle className="text-sm font-semibold flex items-center justify-between">
                          {branch.label}
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 px-4 pb-3 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {branch.description}
                        </p>
                        {branch.previewScore && (
                          <ScoreRow score={branch.previewScore} />
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-7 text-xs gap-1"
                            onClick={() => previewBranch(branch.id)}
                            disabled={isLoading}
                          >
                            <Sparkles className="h-3 w-3" />
                            Refine
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-7 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => selectBranch(branch.id)}
                            disabled={isLoading}
                          >
                            Explore
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No more branches available
                  </p>
                )}

                {/* Exploration path breadcrumb */}
                {session && session.steps.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                      Exploration Path
                    </span>
                    <div className="space-y-1.5">
                      {session.steps.map((step, idx) => (
                        <div
                          key={step.id}
                          className={`flex items-center gap-2 text-xs ${
                            step.id === currentStep?.id
                              ? "text-green-400 font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          <span className="flex items-center justify-center h-4 w-4 rounded-full bg-muted text-[9px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="truncate">{step.prompt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      ) : (
        /* Empty state / initial prompt */
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-lg w-full space-y-6">
            <div className="text-center space-y-2">
              <Compass className="h-12 w-12 mx-auto text-green-500 opacity-60" />
              <h2 className="text-xl font-semibold">Explore an idea</h2>
              <p className="text-sm text-muted-foreground">
                Enter a topic or question and the AI will break it down into sections
                with branching paths to explore further.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="shrink-0 px-4 py-2 bg-red-900/20 border-t border-red-800/30 text-red-400 text-xs">
          {error}
        </div>
      )}

      {/* Bottom prompt bar */}
      {!showHistory && !pending && (
        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasContent ? "Ask a follow-up question..." : "What do you want to explore?"}
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
              disabled={isLoading || isScoring}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleScoreAndRefine}
              disabled={!prompt.trim() || isLoading || isScoring}
              className="shrink-0 h-[44px] px-3 gap-1.5"
              title="Score & Refine before exploring"
            >
              {isScoring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span className="hidden sm:inline text-xs">Refine</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!prompt.trim() || isLoading || isScoring}
              className="shrink-0 h-[44px] px-4 bg-green-600 hover:bg-green-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryList({
  sessions,
  activeId,
  onSelect,
  onDelete,
}: {
  sessions: { id: string; title: string; createdAt: number; updatedAt: number }[]
  activeId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No exploration history yet
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-2">
        {sessions.map((entry) => (
          <Card
            key={entry.id}
            className={`cursor-pointer hover:bg-muted/30 transition-colors ${
              entry.id === activeId ? "border-green-600" : ""
            }`}
            onClick={() => onSelect(entry.id)}
          >
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{entry.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(entry.updatedAt).toLocaleDateString()} &middot;{" "}
                  {new Date(entry.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(entry.id)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  )
}
