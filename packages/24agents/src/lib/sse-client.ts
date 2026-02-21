import type { BranchSuggestion } from "./chat-tree"

const API_BASE = "http://localhost:4000"

export async function* streamChat(
  prompt: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
  systemPrompt?: string,
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, history, systemPrompt }),
  })

  if (!res.ok) {
    throw new Error(`Chat request failed: ${res.status}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6)
      if (data === "[DONE]") return

      try {
        const parsed = JSON.parse(data)
        // The claude-agent-sdk query() yields messages; extract text content
        if (parsed.type === "result" && parsed.result) {
          yield parsed.result
        } else if (parsed.type === "assistant" && parsed.message?.content) {
          for (const block of parsed.message.content) {
            if (block.type === "text") {
              yield block.text
            }
          }
        } else if (typeof parsed === "string") {
          yield parsed
        }
      } catch {
        // skip unparseable lines
      }
    }
  }
}

export async function fetchBranches(
  conversationContext: { role: "user" | "assistant"; content: string }[],
  currentResponse: string,
  personaPrompt?: string,
): Promise<BranchSuggestion[]> {
  const res = await fetch(`${API_BASE}/api/chat/branches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationContext, currentResponse, personaPrompt }),
  })

  if (!res.ok) {
    throw new Error(`Branches request failed: ${res.status}`)
  }

  const data = await res.json()
  return data.branches ?? []
}
