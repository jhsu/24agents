import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, ChevronRight, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScoreRow } from "@/components/ScoreBadge"
import type { IterationScore } from "@/lib/iteration"

interface SectionWithMeta {
  id: string
  title: string
  content: string
  stepId: string
  stepPrompt: string
  stepScore?: IterationScore | null
}

interface SectionPanelProps {
  sections: SectionWithMeta[]
  isLoading?: boolean
}

export function SectionPanel({ sections, isLoading }: SectionPanelProps) {
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Group sections by step
  const groupedByStep = React.useMemo(() => {
    const groups: { stepId: string; stepPrompt: string; stepScore: IterationScore | null; sections: SectionWithMeta[] }[] = []
    for (const section of sections) {
      const last = groups[groups.length - 1]
      if (last && last.stepId === section.stepId) {
        last.sections.push(section)
      } else {
        groups.push({ stepId: section.stepId, stepPrompt: section.stepPrompt, stepScore: section.stepScore ?? null, sections: [section] })
      }
    }
    return groups
  }, [sections])

  // Auto-scroll to bottom when new sections are added
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [sections.length])

  const toggleCollapse = (sectionId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  if (sections.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 px-6">
        <Layers className="h-10 w-10 opacity-40" />
        <p className="text-sm text-center">Sections will appear here as you explore</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full" ref={scrollRef}>
      <div className="p-4 space-y-6">
        {groupedByStep.map((group, groupIdx) => (
          <div key={group.stepId}>
            {/* Step header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-green-600 text-white text-[10px] font-bold shrink-0">
                {groupIdx + 1}
              </span>
              <span className="text-xs font-medium text-muted-foreground truncate">
                {group.stepPrompt}
              </span>
            </div>
            {group.stepScore && (
              <div className="mb-3 ml-7">
                <ScoreRow score={group.stepScore} />
              </div>
            )}
            {!group.stepScore && <div className="mb-2" />}

            {/* Section cards */}
            <div className="space-y-3 pl-3 border-l-2 border-green-600/30">
              {group.sections.map((section) => {
                const isCollapsed = collapsed.has(section.id)
                const isLong = section.content.length > 500

                return (
                  <Card
                    key={section.id}
                    className="bg-card/50 border-border/50"
                  >
                    <CardHeader
                      className={cn(
                        "pb-2 cursor-pointer select-none",
                        isLong && "hover:bg-muted/30 transition-colors"
                      )}
                      onClick={() => isLong && toggleCollapse(section.id)}
                    >
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        {isLong && (
                          isCollapsed
                            ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        {section.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div
                        className={cn(
                          "text-sm text-muted-foreground prose prose-invert prose-sm max-w-none",
                          isCollapsed && "line-clamp-3"
                        )}
                      >
                        {renderMarkdown(section.content)}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Separator between groups */}
            {groupIdx < groupedByStep.length - 1 && (
              <div className="mt-4" />
            )}
          </div>
        ))}

        {isLoading && (
          <div className="space-y-3 pl-3 border-l-2 border-green-600/30">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-card/50 border-border/50 animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="h-3 w-full bg-muted/60 rounded" />
                  <div className="h-3 w-4/5 bg-muted/60 rounded" />
                  <div className="h-3 w-3/5 bg-muted/60 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}

function renderMarkdown(content: string): React.ReactNode {
  // Simple markdown rendering — handles paragraphs, bold, italic, code, lists, headers
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      elements.push(<br key={key++} />)
      continue
    }

    // Headers
    if (trimmed.startsWith("### ")) {
      elements.push(<h4 key={key++} className="font-semibold text-foreground mt-2 mb-1">{formatInline(trimmed.slice(4))}</h4>)
      continue
    }
    if (trimmed.startsWith("## ")) {
      elements.push(<h3 key={key++} className="font-semibold text-foreground mt-2 mb-1">{formatInline(trimmed.slice(3))}</h3>)
      continue
    }
    if (trimmed.startsWith("# ")) {
      elements.push(<h3 key={key++} className="font-bold text-foreground mt-2 mb-1">{formatInline(trimmed.slice(2))}</h3>)
      continue
    }

    // List items
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={key++} className="flex gap-2 ml-2">
          <span className="text-muted-foreground shrink-0">-</span>
          <span>{formatInline(trimmed.slice(2))}</span>
        </div>
      )
      continue
    }

    // Numbered lists
    const numMatch = trimmed.match(/^(\d+)\.\s(.*)/)
    if (numMatch) {
      elements.push(
        <div key={key++} className="flex gap-2 ml-2">
          <span className="text-muted-foreground shrink-0">{numMatch[1]}.</span>
          <span>{formatInline(numMatch[2])}</span>
        </div>
      )
      continue
    }

    // Regular paragraph
    elements.push(<p key={key++} className="mb-1">{formatInline(trimmed)}</p>)
  }

  return <>{elements}</>
}

function formatInline(text: string): React.ReactNode {
  // Handle bold, italic, inline code
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Inline code
    const codeMatch = remaining.match(/`(.+?)`/)
    // Italic
    const italicMatch = remaining.match(/\*(.+?)\*/)
    // Link
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/)

    // Find the earliest match
    const matches = [
      boldMatch ? { type: "bold", match: boldMatch, idx: boldMatch.index! } : null,
      codeMatch ? { type: "code", match: codeMatch, idx: codeMatch.index! } : null,
      italicMatch && (!boldMatch || italicMatch.index! < boldMatch.index!) ? { type: "italic", match: italicMatch, idx: italicMatch.index! } : null,
      linkMatch ? { type: "link", match: linkMatch, idx: linkMatch.index! } : null,
    ].filter(Boolean).sort((a, b) => a!.idx - b!.idx)

    const first = matches[0]
    if (!first) {
      parts.push(remaining)
      break
    }

    // Add text before the match
    if (first.idx > 0) {
      parts.push(remaining.slice(0, first.idx))
    }

    if (first.type === "bold") {
      parts.push(<strong key={key++} className="text-foreground font-semibold">{first.match![1]}</strong>)
    } else if (first.type === "code") {
      parts.push(<code key={key++} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{first.match![1]}</code>)
    } else if (first.type === "link") {
      const url = first.match![2]
      parts.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { e.preventDefault(); window.open(url, "_blank") }}
          className="text-green-400 underline hover:text-green-300"
        >
          {first.match![1]}
        </a>
      )
    } else {
      parts.push(<em key={key++}>{first.match![1]}</em>)
    }

    remaining = remaining.slice(first.idx + first.match![0].length)
  }

  return <>{parts}</>
}
