export interface ExploreSection {
  id: string
  title: string
  content: string
}

export interface ExploreBranch {
  id: string
  label: string
  description: string
}

export interface ExploreStep {
  id: string
  prompt: string
  sections: ExploreSection[]
  branches: ExploreBranch[]
  selectedBranchId: string | null
  parentStepId: string | null
  createdAt: number
}

export interface ExploreSession {
  id: string
  steps: ExploreStep[]
  currentStepId: string | null
  personaId: string | null
  title: string
  createdAt: number
  updatedAt: number
}

export interface ExploreSessionListEntry {
  id: string
  title: string
  createdAt: number
  updatedAt: number
}

const SESSION_PREFIX = "24agents:explore:"
const SESSION_LIST_KEY = "24agents:explore-list"

export function createExploreSession(prompt: string, personaId: string | null): ExploreSession {
  return {
    id: crypto.randomUUID(),
    steps: [],
    currentStepId: null,
    personaId,
    title: prompt.length > 60 ? prompt.slice(0, 60) + "\u2026" : prompt,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function createStep(
  prompt: string,
  sections: ExploreSection[],
  branches: ExploreBranch[],
  parentStepId: string | null,
): ExploreStep {
  return {
    id: crypto.randomUUID(),
    prompt,
    sections,
    branches,
    selectedBranchId: null,
    parentStepId,
    createdAt: Date.now(),
  }
}

export function addStepToSession(
  session: ExploreSession,
  step: ExploreStep,
): ExploreSession {
  // Mark the previous current step's selected branch
  const updatedSteps = session.steps.map((s) => {
    if (s.id === session.currentStepId && step.parentStepId === s.id) {
      // Find which branch was selected by matching the prompt
      const matchingBranch = s.branches.find(
        (b) => b.label === step.prompt || b.description === step.prompt
      )
      return { ...s, selectedBranchId: matchingBranch?.id ?? null }
    }
    return s
  })

  return {
    ...session,
    steps: [...updatedSteps, step],
    currentStepId: step.id,
    updatedAt: Date.now(),
  }
}

export function saveExploreSession(session: ExploreSession): void {
  localStorage.setItem(SESSION_PREFIX + session.id, JSON.stringify(session))
  updateExploreList(session)
}

export function loadExploreSession(id: string): ExploreSession | null {
  try {
    const raw = localStorage.getItem(SESSION_PREFIX + id)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function loadExploreList(): ExploreSessionListEntry[] {
  try {
    const raw = localStorage.getItem(SESSION_LIST_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function deleteExploreSession(id: string): void {
  localStorage.removeItem(SESSION_PREFIX + id)
  const list = loadExploreList().filter((e) => e.id !== id)
  localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(list))
}

function updateExploreList(session: ExploreSession): void {
  const list = loadExploreList()
  const idx = list.findIndex((e) => e.id === session.id)
  const entry: ExploreSessionListEntry = {
    id: session.id,
    title: session.title,
    createdAt: idx >= 0 ? list[idx].createdAt : session.createdAt,
    updatedAt: session.updatedAt,
  }
  if (idx >= 0) {
    list[idx] = entry
  } else {
    list.unshift(entry)
  }
  localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(list))
}
