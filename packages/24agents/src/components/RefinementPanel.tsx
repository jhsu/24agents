import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { ScoreRow } from "@/components/ScoreBadge"
import type { PendingExploration } from "@/lib/exploration"
import type { PersonaPath } from "@/lib/iteration"
import { getInitials } from "@/lib/persona"
import {
  Sparkles,
  ArrowRight,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react"

interface RefinementPanelProps {
  pending: PendingExploration
  personaPaths: PersonaPath[]
  isLoadingPaths: boolean
  isRefining: boolean
  isLoading: boolean
  onRefine: (path: PersonaPath) => void
  onSelectRefinement: (id: string) => void
  onCommit: () => void
  onCancel: () => void
}

export function RefinementPanel({
  pending,
  personaPaths,
  isLoadingPaths,
  isRefining,
  isLoading,
  onRefine,
  onSelectRefinement,
  onCommit,
  onCancel,
}: RefinementPanelProps) {
  return (
    <div className="flex h-full">
      {/* Left: Refinement cards */}
      <div className="flex-1 min-w-0 border-r border-border flex flex-col">
        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Refine Before Exploring
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-2 bg-muted rounded-md">
            <p className="text-sm font-mono">{pending.originalPrompt}</p>
          </div>
        </div>

        {/* Refinement cards list */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {pending.refinements.length === 0 && !isRefining ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Choose a persona from the right panel to refine this prompt
                </p>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
            ) : (
              pending.refinements.map((refinement) => {
                const isActive = refinement.id === pending.activeRefinementId
                return (
                  <Card
                    key={refinement.id}
                    className={`cursor-pointer transition-colors ${
                      isActive ? "border-green-600 bg-green-600/5" : "hover:border-muted-foreground/30"
                    }`}
                    onClick={() => onSelectRefinement(refinement.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-muted">
                            {getInitials(refinement.personaName)}
                          </AvatarFallback>
                        </Avatar>
                        <CardTitle className="text-sm font-medium">
                          {refinement.personaName}
                        </CardTitle>
                        {isActive && (
                          <CheckCircle2 className="h-4 w-4 text-green-500 ml-auto" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <details className="group">
                        <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                          Reasoning
                        </summary>
                        <p className="text-sm text-muted-foreground mt-1">{refinement.reasoning}</p>
                      </details>
                      <div className="p-2 bg-muted rounded-md">
                        <p className="text-sm font-mono">{refinement.refinedPrompt}</p>
                      </div>
                      <ScoreRow score={refinement.score} />
                    </CardContent>
                  </Card>
                )
              })
            )}

            {isRefining && (
              <Card className="animate-pulse">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        {/* Bottom action bar */}
        <div className="shrink-0 border-t border-border p-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onCommit}
            disabled={isLoading || isRefining}
            className="bg-green-600 hover:bg-green-700 text-white flex-1"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Explore {pending.activeRefinementId ? "Refined Prompt" : "Original"}
          </Button>
        </div>
      </div>

      {/* Right: Persona suggestions */}
      <div className="w-72 shrink-0 flex flex-col">
        <div className="shrink-0 px-4 pt-4 pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Persona Perspectives
          </span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 pt-2 space-y-2">
            {isLoadingPaths ? (
              [1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="py-3 px-4">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-3 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : personaPaths.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Add personas in the Manage tab to see refinement suggestions here
              </p>
            ) : (
              personaPaths.map((path) => {
                const alreadyRefined = pending.refinements.some((r) => r.personaId === path.personaId)
                return (
                  <Card
                    key={path.personaId}
                    className={`cursor-pointer transition-colors ${
                      alreadyRefined
                        ? "opacity-50 border-muted"
                        : "hover:border-yellow-600/50 hover:bg-yellow-600/5"
                    }`}
                    onClick={() => !alreadyRefined && !isRefining && onRefine(path)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[10px] bg-muted">
                            {path.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{path.personaName}</span>
                        {alreadyRefined && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-auto" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {path.description}
                      </p>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
