export interface IterationScore {
  C: number // Clarity
  F: number // Feasibility
  N: number // Novelty
  R: number // Relevance
}

export interface Iteration {
  id: string
  personaId: string
  personaName: string
  refinedPrompt: string
  responseText: string
  score: IterationScore
  parentIterationId: string | null
  createdAt: number
}

export interface PersonaPath {
  personaId: string
  personaName: string
  initials: string
  description: string
}

export interface PromptSession {
  id: string
  originalPrompt: string
  iterations: Iteration[]
  currentIterationId: string | null
}

const SESSION_PREFIX = "24agents:session:"
const SESSION_LIST_KEY = "24agents:session-list"

export interface SessionListEntry {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

export function createSession(originalPrompt: string): PromptSession {
  return {
    id: crypto.randomUUID(),
    originalPrompt,
    iterations: [],
    currentIterationId: null,
  }
}

export function addIteration(
  session: PromptSession,
  iteration: Iteration,
): PromptSession {
  return {
    ...session,
    iterations: [...session.iterations, iteration],
    currentIterationId: iteration.id,
  }
}

export function saveSession(session: PromptSession): void {
  localStorage.setItem(SESSION_PREFIX + session.id, JSON.stringify(session))
  updateSessionList(session)
}

export function loadSession(id: string): PromptSession | null {
  try {
    const raw = localStorage.getItem(SESSION_PREFIX + id)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function formatScore(score: IterationScore): string {
  return `C ${score.C} | F ${score.F} | N ${score.N} | R ${score.R}`
}

export function scoreColor(value: number): string {
  if (value >= 7) return "text-green-400"
  if (value >= 5) return "text-yellow-400"
  return "text-red-400"
}

export function loadSessionList(): SessionListEntry[] {
  try {
    const raw = localStorage.getItem(SESSION_LIST_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function deleteSession(id: string): void {
  localStorage.removeItem(SESSION_PREFIX + id)
  const list = loadSessionList().filter((e) => e.id !== id)
  localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(list))
}

function updateSessionList(session: PromptSession): void {
  const list = loadSessionList()
  const idx = list.findIndex((e) => e.id === session.id)
  const title =
    session.originalPrompt.length > 60
      ? session.originalPrompt.slice(0, 60) + "…"
      : session.originalPrompt
  const entry: SessionListEntry = {
    id: session.id,
    title,
    createdAt: idx >= 0 ? list[idx].createdAt : Date.now(),
    updatedAt: Date.now(),
  }
  if (idx >= 0) {
    list[idx] = entry
  } else {
    list.unshift(entry)
  }
  localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(list))
}
