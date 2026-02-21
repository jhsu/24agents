import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./chat.css";

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface SDKMessage {
  type: string;
  subtype?: string;
  message?: {
    role: string;
    content: ContentBlock[];
  };
  result?: string;
  error?: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  events?: AgentEvent[];
}

interface AgentEvent {
  type: "tool_use" | "text";
  label: string;
}

function parseAgentMessage(msg: SDKMessage): {
  text: string;
  events: AgentEvent[];
} {
  const events: AgentEvent[] = [];
  let text = "";

  if (msg.type === "assistant" && msg.message?.content) {
    for (const block of msg.message.content) {
      if (block.type === "text" && block.text) {
        text += block.text;
      } else if (block.type === "tool_use" && block.name) {
        events.push({ type: "tool_use", label: `Using tool: ${block.name}` });
      }
    }
  } else if (msg.type === "result" && msg.result) {
    text = msg.result;
  } else if (msg.type === "error" && msg.error) {
    text = `Error: ${msg.error}`;
  }

  return { text, events };
}

function AgentEventBadge({ event }: { event: AgentEvent }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {event.label}
    </span>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="flex max-w-[80%] flex-col gap-1">
        {!isUser && message.events && message.events.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {message.events.map((e, i) => (
              <AgentEventBadge key={i} event={e} />
            ))}
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          }`}
        >
          {message.content || (
            <span className="text-muted-foreground italic">Thinking…</span>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    setInput("");
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    const assistantIndex = messages.length + 1;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", events: [] },
    ]);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: resp.statusText }));
        setMessages((prev) =>
          prev.map((m, i) =>
            i === assistantIndex
              ? { ...m, content: `Error: ${err.error || "Request failed"}` }
              : m
          )
        );
        return;
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") break;

          try {
            const msg: SDKMessage = JSON.parse(raw);
            const { text, events } = parseAgentMessage(msg);

            if (text || events.length > 0) {
              setMessages((prev) =>
                prev.map((m, i) =>
                  i === assistantIndex
                    ? {
                        ...m,
                        content: m.content + text,
                        events: [...(m.events ?? []), ...events],
                      }
                    : m
                )
              );
            }
          } catch {
            // skip unparseable lines
          }
        }
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === assistantIndex
            ? { ...m, content: `Error: ${String(error)}` }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <main className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <h1 className="text-lg font-semibold">24agents</h1>
        <p className="text-muted-foreground text-sm">
          Powered by Claude Agent SDK
        </p>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-muted-foreground text-sm">
                Send a message to start a conversation.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Press Enter to send, Shift+Enter for a new line.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t px-4 py-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message 24agents…"
            rows={3}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="self-end rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {isLoading ? "…" : "Send"}
          </button>
        </div>
      </div>
    </main>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
