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
