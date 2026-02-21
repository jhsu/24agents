import type { BranchSuggestion } from "./chat-tree"
import type { ExternalResource } from "./iteration"
import type { ExploreSection, ExploreBranch } from "./exploration"

const API_BASE = "http://localhost:4000"

export async function* streamChat(
  prompt: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
  systemPrompt?: string,
  sessionId?: string,
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, history, systemPrompt, sessionId }),
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
        if (parsed.type === "text" && parsed.text) {
          yield parsed.text
        } else if (parsed.type === "error") {
          console.error("Chat error:", parsed.error)
        }
      } catch {
        // skip unparseable lines
      }
    }
  }
}

export async function explorePrompt(
  prompt: string,
  history: { role: string; content: string }[] = [],
  systemPrompt?: string,
  sessionId?: string,
): Promise<{ sections: ExploreSection[]; branches: ExploreBranch[] }> {
  const res = await fetch(`${API_BASE}/api/chat/explore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, history, systemPrompt, sessionId }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(err.error || `Explore request failed: ${res.status}`)
  }

  const data = await res.json()
  return {
    sections: data.sections ?? [],
    branches: data.branches ?? [],
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

export async function persistToMemory(
  sessionId: string,
  messages: { role: "user" | "assistant"; content: string }[],
  title: string,
  personaId: string | null,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/memory/persist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, messages, title, personaId }),
    })
  } catch {
    // Memory persistence is optional — fail silently
  }
}

export async function rewritePrompt(
  prompt: string,
  personaPrompt: string,
  iterationContext?: string,
  promptContext?: string,
  promptGoals?: string,
): Promise<{ refinedPrompt: string; responseText: string; score: { C: number; F: number; N: number; R: number } }> {
  const res = await fetch(`${API_BASE}/api/chat/rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, personaPrompt, iterationContext, context: promptContext, goals: promptGoals }),
  })

  if (!res.ok) {
    throw new Error(`Rewrite request failed: ${res.status}`)
  }

  return await res.json()
}

export async function fetchPersonaPaths(
  prompt: string,
  personas: { id: string; name: string; description: string }[],
): Promise<{ personaId: string; personaName: string; initials: string; description: string }[]> {
  const res = await fetch(`${API_BASE}/api/chat/persona-paths`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, personas }),
  })

  if (!res.ok) {
    throw new Error(`Persona paths request failed: ${res.status}`)
  }

  const data = await res.json()
  return data.paths ?? []
}

export async function generatePersonaSettings(
  name: string,
  description: string,
): Promise<{ spec: unknown | null; state: Record<string, unknown> | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/persona/generate-settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    })
    if (!res.ok) return { spec: null, state: null }
    return await res.json()
  } catch {
    return { spec: null, state: null }
  }
}

export async function fetchResources(
  prompt: string,
  context?: string,
  goals?: string,
  personaName?: string,
): Promise<ExternalResource[]> {
  try {
    const res = await fetch(`${API_BASE}/api/chat/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, context, goals, personaName }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.resources ?? []
  } catch {
    return []
  }
}

export async function searchMemory(
  query: string,
  limit = 10,
): Promise<{ memories: unknown[]; total: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/memory/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    })
    if (!res.ok) return { memories: [], total: 0 }
    return await res.json()
  } catch {
    return { memories: [], total: 0 }
  }
}
