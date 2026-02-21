import { useState } from "react"
import { Button } from "@/components/ui/button"
import { PromptBar } from "@/components/PromptBar"
import { IterationTimeline } from "@/components/IterationTimeline"
import { PersonaPathsPanel } from "@/components/PersonaPathsPanel"
import { usePromptSession } from "@/hooks/usePromptSession"

export function PersonaChatWorkspace() {
  const [showHistory, setShowHistory] = useState(false)

  const {
    session,
    isGenerating,
    personaPaths,
    isLoadingPaths,
    sessionList,
    startSession,
    loadExistingSession,
    removeSession,
    followPersona,
    continueFromIteration,
    reset,
    refreshList,
  } = usePromptSession()

  const handleNewChat = () => {
    reset()
    setShowHistory(false)
  }

  const handleLoadSession = (id: string) => {
    loadExistingSession(id)
    setShowHistory(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { refreshList(); setShowHistory(!showHistory) }}
        >
          {showHistory ? "Back" : "History"}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleNewChat}>
          New
        </Button>
        {session && !showHistory && (
          <span className="text-xs text-muted-foreground truncate ml-2">
            {session.originalPrompt.length > 80
              ? session.originalPrompt.slice(0, 80) + "…"
              : session.originalPrompt}
          </span>
        )}
      </div>

      {showHistory ? (
        /* Session history list */
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-2xl space-y-2">
            <h2 className="text-sm font-medium mb-3">Chat Sessions</h2>
            {sessionList.length === 0 ? (
              <p className="text-muted-foreground text-xs">No sessions yet.</p>
            ) : (
              sessionList.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between rounded-lg border p-3 hover:bg-accent cursor-pointer ${
                    session?.id === entry.id ? "border-green-600" : "border-border"
                  }`}
                  onClick={() => handleLoadSession(entry.id)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{entry.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive shrink-0 ml-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeSession(entry.id)
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <>
          <PromptBar
            onGenerate={startSession}
            onReset={reset}
            isGenerating={isGenerating}
            hasSession={!!session}
          />

          {session ? (
            <div className="flex flex-1 min-h-0">
              <div className="flex-1 min-w-0">
                <IterationTimeline
                  originalPrompt={session.originalPrompt}
                  iterations={session.iterations}
                  currentIterationId={session.currentIterationId}
                  onContinue={continueFromIteration}
                  isGenerating={isGenerating}
                />
              </div>
              <div className="w-80 border-l border-border shrink-0">
                <PersonaPathsPanel
                  paths={personaPaths}
                  isLoading={isLoadingPaths}
                  isGenerating={isGenerating}
                  onFollowPersona={followPersona}
                  hasSession={true}
                  activePersonaId={
                    session.currentIterationId
                      ? session.iterations.find((i) => i.id === session.currentIterationId)?.personaId
                      : null
                  }
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-lg text-muted-foreground">
                  Enter a prompt above to start refining with personas
                </p>
                <p className="text-sm text-muted-foreground">
                  Make sure you have personas created in the "Manage Personas" tab
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
