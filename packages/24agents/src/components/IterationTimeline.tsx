import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Iteration } from "@/lib/iteration"
import { scoreColor } from "@/lib/iteration"
import { getInitials } from "@/lib/persona"

interface IterationTimelineProps {
  originalPrompt: string
  iterations: Iteration[]
  currentIterationId: string | null
  onContinue: (iterationId: string) => void
  isGenerating: boolean
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className={`text-xs font-mono ${scoreColor(value)}`}>
      {label} {value}
    </span>
  )
}

function IterationCard({
  iteration,
  isCurrent,
  onContinue,
  isGenerating,
}: {
  iteration: Iteration
  isCurrent: boolean
  onContinue: () => void
  isGenerating: boolean
}) {
  const time = new Date(iteration.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <Card className={`${isCurrent ? "border-green-600" : "border-border"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs bg-muted">
              {getInitials(iteration.personaName)}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="text-sm font-medium">
            {iteration.personaName}
          </CardTitle>
          <span className="text-xs text-muted-foreground ml-auto">{time}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{iteration.responseText}</p>
        <div className="p-2 bg-muted rounded-md">
          <p className="text-sm font-mono">{iteration.refinedPrompt}</p>
        </div>
        <div className="flex items-center gap-3">
          <ScoreBadge label="C" value={iteration.score.C} />
          <ScoreBadge label="F" value={iteration.score.F} />
          <ScoreBadge label="N" value={iteration.score.N} />
          <ScoreBadge label="R" value={iteration.score.R} />
        </div>
        {!isCurrent && (
          <Button
            size="sm"
            variant="outline"
            onClick={onContinue}
            disabled={isGenerating}
            className="w-full"
          >
            Continue This Path
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function IterationTimeline({
  originalPrompt,
  iterations,
  currentIterationId,
  onContinue,
  isGenerating,
}: IterationTimelineProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Generated Response
        </h3>
        <p className="text-sm mt-1 text-foreground">{originalPrompt}</p>
      </div>

      <div className="px-4 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Iteration Timeline
        </h3>
      </div>

      <ScrollArea className="flex-1 px-4 pb-4">
        {iterations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Select a persona path to start refining your prompt.
          </p>
        ) : (
          <div className="space-y-3">
            {iterations.map((iteration) => (
              <IterationCard
                key={iteration.id}
                iteration={iteration}
                isCurrent={iteration.id === currentIterationId}
                onContinue={() => onContinue(iteration.id)}
                isGenerating={isGenerating}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
