import * as React from "react"
import {
  type ExploreSession,
  type ExploreSessionListEntry,
  createExploreSession,
  createStep,
  addStepToSession,
  saveExploreSession,
  loadExploreSession,
  loadExploreList,
  deleteExploreSession,
} from "@/lib/exploration"
import { explorePrompt } from "@/lib/sse-client"
import { serializePersona, loadPersonas, type Persona } from "@/lib/persona"

export function useExploration() {
  const [session, setSession] = React.useState<ExploreSession | null>(null)
  const [sessionList, setSessionList] = React.useState<ExploreSessionListEntry[]>(() => loadExploreList())
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [personaId, setPersonaId] = React.useState<string | null>(null)

  const currentStep = React.useMemo(() => {
    if (!session?.currentStepId) return null
    return session.steps.find((s) => s.id === session.currentStepId) ?? null
  }, [session])

  const allSections = React.useMemo(() => {
    if (!session) return []
    return session.steps.flatMap((step) =>
      step.sections.map((section) => ({ ...section, stepId: step.id, stepPrompt: step.prompt }))
    )
  }, [session])

  const buildHistory = React.useCallback((sess: ExploreSession) => {
    const history: { role: string; content: string }[] = []
    for (const step of sess.steps) {
      history.push({ role: "user", content: step.prompt })
      const summary = step.sections.map((s) => `## ${s.title}\n${s.content}`).join("\n\n")
      history.push({ role: "assistant", content: summary })
    }
    return history
  }, [])

  const getSystemPrompt = React.useCallback(() => {
    if (!personaId) return undefined
    const personas = loadPersonas()
    const persona = personas.find((p: Persona) => p.id === personaId)
    if (!persona) return undefined
    return serializePersona(persona)
  }, [personaId])

  const startExploration = React.useCallback(async (prompt: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const newSession = createExploreSession(prompt, personaId)
      const systemPrompt = getSystemPrompt()
      const result = await explorePrompt(prompt, [], systemPrompt, newSession.id)

      const step = createStep(prompt, result.sections, result.branches, null)
      const updatedSession = addStepToSession(newSession, step)
      saveExploreSession(updatedSession)
      setSession(updatedSession)
      setSessionList(loadExploreList())
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }, [personaId, getSystemPrompt])

  const selectBranch = React.useCallback(async (branchId: string) => {
    if (!session || !currentStep) return

    const branch = currentStep.branches.find((b) => b.id === branchId)
    if (!branch) return

    setIsLoading(true)
    setError(null)
    try {
      // Mark the branch as selected on the current step
      const sessionWithSelection = {
        ...session,
        steps: session.steps.map((s) =>
          s.id === currentStep.id ? { ...s, selectedBranchId: branchId } : s
        ),
      }

      const branchPrompt = `${branch.label}: ${branch.description}`
      const history = buildHistory(sessionWithSelection)
      const systemPrompt = getSystemPrompt()
      const result = await explorePrompt(branchPrompt, history, systemPrompt, session.id)

      const step = createStep(branch.label, result.sections, result.branches, currentStep.id)
      const updatedSession = addStepToSession(sessionWithSelection, step)
      saveExploreSession(updatedSession)
      setSession(updatedSession)
      setSessionList(loadExploreList())
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }, [session, currentStep, buildHistory, getSystemPrompt])

  const loadSession = React.useCallback((id: string) => {
    const loaded = loadExploreSession(id)
    if (loaded) {
      setSession(loaded)
      setPersonaId(loaded.personaId)
    }
  }, [])

  const removeSession = React.useCallback((id: string) => {
    deleteExploreSession(id)
    setSessionList(loadExploreList())
    if (session?.id === id) {
      setSession(null)
    }
  }, [session])

  const reset = React.useCallback(() => {
    setSession(null)
    setError(null)
  }, [])

  const refreshList = React.useCallback(() => {
    setSessionList(loadExploreList())
  }, [])

  return {
    session,
    currentStep,
    allSections,
    isLoading,
    error,
    personaId,
    setPersonaId,
    startExploration,
    selectBranch,
    sessionList,
    loadSession,
    removeSession,
    reset,
    refreshList,
  }
}
