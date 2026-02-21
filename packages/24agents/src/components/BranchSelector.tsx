import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { BranchSuggestion } from "@/lib/chat-tree"

interface BranchSelectorProps {
  branches: BranchSuggestion[]
  isLoading: boolean
  onSelect: (branch: BranchSuggestion) => void
  disabled?: boolean
}

export function BranchSelector({ branches, isLoading, onSelect, disabled }: BranchSelectorProps) {
  if (isLoading) {
    return (
      <div className="flex gap-2 pl-10">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1">
            <Skeleton className="h-20 rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (branches.length === 0) return null

  return (
    <div className="flex gap-2 pl-10">
      {branches.map((branch) => (
        <Card
          key={branch.id}
          size="sm"
          className={`flex-1 cursor-pointer transition-colors hover:bg-accent ${disabled ? "pointer-events-none opacity-50" : ""}`}
          onClick={() => !disabled && onSelect(branch)}
        >
          <CardHeader>
            <CardTitle className="text-xs">{branch.label}</CardTitle>
            <CardDescription className="text-xs">
              {branch.description}
            </CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
