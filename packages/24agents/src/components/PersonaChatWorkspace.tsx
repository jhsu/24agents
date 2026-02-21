import { PromptBar } from "@/components/PromptBar"
import { IterationTimeline } from "@/components/IterationTimeline"
import { PersonaPathsPanel } from "@/components/PersonaPathsPanel"
import { usePromptSession } from "@/hooks/usePromptSession"

export function PersonaChatWorkspace() {
  const {
    session,
    isGenerating,
    personaPaths,
    isLoadingPaths,
    startSession,
    followPersona,
    continueFromIteration,
    reset,
  } = usePromptSession()

  return (
    <div className="flex flex-col h-full">
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
    </div>
  )
}
