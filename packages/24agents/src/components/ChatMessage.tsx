import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  personaInitials?: string
  isStreaming?: boolean
}

export function ChatMessage({ role, content, personaInitials, isStreaming }: ChatMessageProps) {
  const isUser = role === "user"

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      <Avatar size="sm" className="mt-0.5 shrink-0">
        <AvatarFallback>
          {isUser ? "You" : personaInitials ?? "AI"}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
          isStreaming && "animate-pulse",
        )}
      >
        {content}
        {isStreaming && !content && (
          <span className="text-muted-foreground">Thinking...</span>
        )}
      </div>
    </div>
  )
}
