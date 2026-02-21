import * as React from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChatMessage } from "@/components/ChatMessage"
import { BranchSelector } from "@/components/BranchSelector"
import { BranchBreadcrumb } from "@/components/BranchBreadcrumb"
import { ChatInput } from "@/components/ChatInput"
import { PersonaSelector } from "@/components/PersonaSelector"
import { useChatTree } from "@/hooks/useChatTree"
import { useChatList } from "@/hooks/useChatList"
import type { Persona } from "@/components/PersonaManagement"
import { serializePersona, getInitials } from "@/lib/persona"
import type { BranchSuggestion } from "@/lib/chat-tree"

export function BranchingChat() {
  const [selectedPersona, setSelectedPersona] = React.useState<Persona | null>(null)
  const [showHistory, setShowHistory] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const {
    tree,
    currentPath,
    isStreaming,
    isFetchingBranches,
    streamingContent,
    sendMessage,
    selectBranch,
    navigateTo,
    resetTree,
    loadTree,
  } = useChatTree(undefined, selectedPersona?.id ?? null)

  const { entries, refresh, remove } = useChatList()

  const systemPrompt = selectedPersona ? serializePersona(selectedPersona) : undefined
  const personaInitials = selectedPersona ? getInitials(selectedPersona.name) : undefined

  // Scroll to bottom on new messages
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [currentPath, streamingContent, isFetchingBranches])

  const handleSend = (content: string) => {
    sendMessage(content, systemPrompt)
  }

  const handleBranchSelect = (nodeId: string, branch: BranchSuggestion) => {
    selectBranch(nodeId, branch, systemPrompt)
  }

  const handleNewChat = () => {
    refresh()
    resetTree(selectedPersona?.id ?? null)
  }

  const handleLoadChat = (id: string) => {
    loadTree(id)
    setShowHistory(false)
  }

  const handlePersonaSelect = (persona: Persona | null) => {
    setSelectedPersona(persona)
  }

  // Find the last assistant node in current path to show branches
  const lastAssistantNode = [...currentPath].reverse().find((n) => n.role === "assistant")
  const showBranches =
    lastAssistantNode &&
    tree.currentNodeId === lastAssistantNode.id &&
    !isStreaming

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { refresh(); setShowHistory(!showHistory) }}
          >
            {showHistory ? "Back" : "History"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleNewChat}>
            New
          </Button>
          <BranchBreadcrumb path={currentPath} onNavigate={navigateTo} />
        </div>
        <PersonaSelector
          selectedId={selectedPersona?.id ?? null}
          onSelect={handlePersonaSelect}
        />
      </div>

      {showHistory ? (
        /* Conversation history list */
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-2xl space-y-2">
            <h2 className="text-sm font-medium mb-3">Conversations</h2>
            {entries.length === 0 ? (
              <p className="text-muted-foreground text-xs">No conversations yet.</p>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent cursor-pointer"
                  onClick={() => handleLoadChat(entry.id)}
                >
                  <div>
                    <p className="text-sm font-medium">{entry.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      remove(entry.id)
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
        /* Chat area */
        <>
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="mx-auto max-w-2xl space-y-4 p-4">
              {currentPath.length === 0 && !isStreaming && (
                <div className="flex h-[60vh] items-center justify-center">
                  <div className="text-center">
                    <h2 className="text-lg font-medium mb-1">Start exploring</h2>
                    <p className="text-sm text-muted-foreground">
                      Type a message to begin. The AI will suggest branching paths to explore.
                    </p>
                  </div>
                </div>
              )}

              {currentPath.map((node) => (
                <React.Fragment key={node.id}>
                  <ChatMessage
                    role={node.role}
                    content={node.content}
                    personaInitials={personaInitials}
                  />
                  {/* Show branches on assistant nodes that are branch points */}
                  {node.role === "assistant" &&
                    node.branches.length > 0 &&
                    node.selectedBranchId && (
                      <div className="pl-10 text-xs text-muted-foreground">
                        Explored: {node.branches.find((b) => b.id === node.selectedBranchId)?.label}
                      </div>
                    )}
                </React.Fragment>
              ))}

              {/* Streaming message */}
              {isStreaming && (
                <ChatMessage
                  role="assistant"
                  content={streamingContent}
                  personaInitials={personaInitials}
                  isStreaming
                />
              )}

              {/* Branch suggestions on the last assistant node */}
              {showBranches && lastAssistantNode && (
                <BranchSelector
                  branches={lastAssistantNode.branches}
                  isLoading={isFetchingBranches}
                  onSelect={(branch) => handleBranchSelect(lastAssistantNode.id, branch)}
                  disabled={isStreaming}
                />
              )}

              {/* Loading branches skeleton */}
              {!isStreaming && isFetchingBranches && (
                <BranchSelector
                  branches={[]}
                  isLoading={true}
                  onSelect={() => {}}
                />
              )}
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="border-t border-border px-4 py-3">
            <div className="mx-auto max-w-2xl">
              <ChatInput onSend={handleSend} disabled={isStreaming} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
