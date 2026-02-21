import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { PersonaPath } from "@/lib/iteration"

interface PersonaPathsPanelProps {
  paths: PersonaPath[]
  isLoading: boolean
  isGenerating: boolean
  onFollowPersona: (path: PersonaPath) => void
  hasSession: boolean
}

function PersonaPathCard({
  path,
  onFollow,
  isGenerating,
}: {
  path: PersonaPath
  onFollow: () => void
  isGenerating: boolean
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-green-600/20 text-green-400">
              {path.initials}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="text-sm font-medium">
            {path.personaName}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{path.description}</p>
        <Button
          size="sm"
          onClick={onFollow}
          disabled={isGenerating}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          Follow Persona
        </Button>
      </CardContent>
    </Card>
  )
}

function PathSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  )
}

export function PersonaPathsPanel({
  paths,
  isLoading,
  isGenerating,
  onFollowPersona,
  hasSession,
}: PersonaPathsPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Persona Paths to Follow
        </h3>
      </div>

      <ScrollArea className="flex-1 px-4 pb-4">
        {!hasSession ? (
          <p className="text-sm text-muted-foreground py-4">
            Enter a prompt and click Generate to see persona suggestions.
          </p>
        ) : isLoading ? (
          <div className="space-y-3">
            <PathSkeleton />
            <PathSkeleton />
            <PathSkeleton />
          </div>
        ) : paths.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No personas found. Create some in the "Manage Personas" tab first.
          </p>
        ) : (
          <div className="space-y-3">
            {paths.map((path) => (
              <PersonaPathCard
                key={path.personaId}
                path={path}
                onFollow={() => onFollowPersona(path)}
                isGenerating={isGenerating}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
