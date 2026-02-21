import { Button } from "@/components/ui/button"
import type { ChatNode } from "@/lib/chat-tree"

interface BranchBreadcrumbProps {
  path: ChatNode[]
  onNavigate: (nodeId: string) => void
}

export function BranchBreadcrumb({ path, onNavigate }: BranchBreadcrumbProps) {
  // Only show nodes that have branches (branch points)
  const branchPoints = path.filter(
    (node) => node.role === "assistant" && node.branches.length > 0,
  )

  if (branchPoints.length === 0) return null

  return (
    <div className="flex items-center gap-1 overflow-x-auto text-xs">
      <span className="text-muted-foreground shrink-0">Branches:</span>
      {branchPoints.map((node, i) => (
        <span key={node.id} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground">/</span>}
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-1.5 py-0.5 text-xs"
            onClick={() => onNavigate(node.id)}
          >
            {node.content.slice(0, 30)}
            {node.content.length > 30 ? "..." : ""}
          </Button>
        </span>
      ))}
    </div>
  )
}
