import * as React from "react"
import {
  type ExploreSession,
  type ExploreSessionListEntry,
  type PendingExploration,
  type PromptRefinement,
  createExploreSession,
  createStep,
  addStepToSession,
  saveExploreSession,
  loadExploreSession,
  loadExploreList,
  deleteExploreSession,
} from "@/lib/exploration"
import type { IterationScore } from "@/lib/iteration"
import type { PersonaPath } from "@/lib/iteration"
import { explorePrompt, rewritePrompt, fetchPersonaPaths, scorePrompt } from "@/lib/sse-client"
import { serializePersona, loadPersonas, type Persona } from "@/lib/persona"

export function useExploration() {
  const [session, setSession] = React.useState<ExploreSession | null>(null)
  const [sessionList, setSessionList] = React.useState<ExploreSessionListEntry[]>(() => loadExploreList())
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [personaId, setPersonaId] = React.useState<string | null>(null)

  // Refinement state
  const [pending, setPending] = React.useState<PendingExploration | null>(null)
  const [isScoring, setIsScoring] = React.useState(false)
  const [isRefining, setIsRefining] = React.useState(false)
  const [personaPaths, setPersonaPaths] = React.useState<PersonaPath[]>([])
  const [isLoadingPaths, setIsLoadingPaths] = React.useState(false)

  const currentStep = React.useMemo(() => {
    if (!session?.currentStepId) return null
    return session.steps.find((s) => s.id === session.currentStepId) ?? null
  }, [session])

  const allSections = React.useMemo(() => {
    if (!session) return []
    return session.steps.flatMap((step) =>
      step.sections.map((section) => ({
        ...section,
        stepId: step.id,
        stepPrompt: step.prompt,
        stepScore: step.score,
      }))
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

  // Load persona paths for a prompt
  const loadPaths = React.useCallback(async (prompt: string) => {
    const personas = loadPersonas()
    if (personas.length === 0) {
      setPersonaPaths([])
      return
    }
    setIsLoadingPaths(true)
    try {
      const paths = await fetchPersonaPaths(
        prompt,
        personas.map((p: Persona) => ({ id: p.id, name: p.name, description: p.description }))
      )
      setPersonaPaths(paths)
    } catch {
      setPersonaPaths([])
    } finally {
      setIsLoadingPaths(false)
    }
  }, [])

  const startExploration = React.useCallback(async (prompt: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const newSession = createExploreSession(prompt, personaId)
      const systemPrompt = getSystemPrompt()
      const result = await explorePrompt(prompt, [], systemPrompt, newSession.id)

      const step = createStep(prompt, result.sections, result.branches, null, result.promptScore)
      const updatedSession = addStepToSession(newSession, step)
      saveExploreSession(updatedSession)
      setSession(updatedSession)
      setSessionList(loadExploreList())
      setPending(null)
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

      const step = createStep(branch.label, result.sections, result.branches, currentStep.id, result.promptScore)
      const updatedSession = addStepToSession(sessionWithSelection, step)
      saveExploreSession(updatedSession)
      setSession(updatedSession)
      setSessionList(loadExploreList())
      setPending(null)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }, [session, currentStep, buildHistory, getSystemPrompt])

  // Enter refinement mode for a prompt
  const enterRefinementMode = React.useCallback((prompt: string, parentStepId: string | null = null) => {
    setPending({
      originalPrompt: prompt,
      refinements: [],
      activeRefinementId: null,
      parentStepId,
    })
    loadPaths(prompt)
  }, [loadPaths])

  // Enter refinement mode for a branch
  const previewBranch = React.useCallback((branchId: string) => {
    if (!currentStep) return
    const branch = currentStep.branches.find((b) => b.id === branchId)
    if (!branch) return

    const branchPrompt = `${branch.label}: ${branch.description}`
    enterRefinementMode(branchPrompt, currentStep.id)
  }, [currentStep, enterRefinementMode])

  // Score and enter refinement mode
  const scoreAndRefine = React.useCallback(async (prompt: string) => {
    setIsScoring(true)
    try {
      const systemPrompt = getSystemPrompt()
      const score = await scorePrompt(prompt, systemPrompt)
      setPending({
        originalPrompt: prompt,
        refinements: [],
        activeRefinementId: null,
        parentStepId: currentStep?.id ?? null,
      })
      loadPaths(prompt)
      // Return score for the caller to display if needed
      return score
    } finally {
      setIsScoring(false)
    }
  }, [getSystemPrompt, currentStep, loadPaths])

  // Refine a prompt using a persona
  const refinePrompt = React.useCallback(async (personaPath: PersonaPath) => {
    if (!pending) return

    setIsRefining(true)
    setError(null)
    try {
      const persona = loadPersonas().find((p: Persona) => p.id === personaPath.personaId)
      if (!persona) throw new Error("Persona not found")

      const personaPrompt = serializePersona(persona)
      const iterationContext = pending.refinements.length > 0
        ? `Previous refinements:\n${pending.refinements.map((r) => `- ${r.personaName}: "${r.refinedPrompt}"`).join("\n")}`
        : undefined

      const result = await rewritePrompt(
        pending.originalPrompt,
        personaPrompt,
        iterationContext,
      )

      const refinement: PromptRefinement = {
        id: crypto.randomUUID(),
        personaId: personaPath.personaId,
        personaName: personaPath.personaName,
        refinedPrompt: result.refinedPrompt,
        reasoning: result.responseText,
        score: result.score as IterationScore,
        createdAt: Date.now(),
      }

      setPending((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          refinements: [...prev.refinements, refinement],
          activeRefinementId: refinement.id,
        }
      })
    } catch (err) {
      setError(String(err))
    } finally {
      setIsRefining(false)
    }
  }, [pending])

  // Select a refinement as active
  const selectRefinement = React.useCallback((refinementId: string) => {
    setPending((prev) => {
      if (!prev) return prev
      return { ...prev, activeRefinementId: refinementId }
    })
  }, [])

  // Commit exploration — use the active refinement or original prompt
  const commitExploration = React.useCallback(async () => {
    if (!pending) return

    const activeRefinement = pending.activeRefinementId
      ? pending.refinements.find((r) => r.id === pending.activeRefinementId)
      : null

    const promptToUse = activeRefinement?.refinedPrompt ?? pending.originalPrompt

    if (!session) {
      // New exploration
      setIsLoading(true)
      setError(null)
      try {
        const newSession = createExploreSession(pending.originalPrompt, personaId)
        const systemPrompt = getSystemPrompt()
        const result = await explorePrompt(promptToUse, [], systemPrompt, newSession.id)

        const step = createStep(
          promptToUse,
          result.sections,
          result.branches,
          null,
          result.promptScore,
          pending.refinements,
          pending.activeRefinementId,
        )
        const updatedSession = addStepToSession(newSession, step)
        saveExploreSession(updatedSession)
        setSession(updatedSession)
        setSessionList(loadExploreList())
        setPending(null)
      } catch (err) {
        setError(String(err))
      } finally {
        setIsLoading(false)
      }
    } else {
      // Branch exploration
      setIsLoading(true)
      setError(null)
      try {
        const history = buildHistory(session)
        const systemPrompt = getSystemPrompt()
        const result = await explorePrompt(promptToUse, history, systemPrompt, session.id)

        const step = createStep(
          promptToUse,
          result.sections,
          result.branches,
          pending.parentStepId,
          result.promptScore,
          pending.refinements,
          pending.activeRefinementId,
        )

        // Mark the parent step's branch as selected if applicable
        let sessionBase = session
        if (pending.parentStepId && currentStep) {
          sessionBase = {
            ...session,
            steps: session.steps.map((s) =>
              s.id === pending.parentStepId ? { ...s, selectedBranchId: null } : s
            ),
          }
        }

        const updatedSession = addStepToSession(sessionBase, step)
        saveExploreSession(updatedSession)
        setSession(updatedSession)
        setSessionList(loadExploreList())
        setPending(null)
      } catch (err) {
        setError(String(err))
      } finally {
        setIsLoading(false)
      }
    }
  }, [pending, session, personaId, currentStep, buildHistory, getSystemPrompt])

  const cancelRefinement = React.useCallback(() => {
    setPending(null)
    setPersonaPaths([])
  }, [])

  const loadSession = React.useCallback((id: string) => {
    const loaded = loadExploreSession(id)
    if (loaded) {
      setSession(loaded)
      setPersonaId(loaded.personaId)
      setPending(null)
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
    setPending(null)
    setPersonaPaths([])
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
    // Refinement
    pending,
    isScoring,
    isRefining,
    personaPaths,
    isLoadingPaths,
    enterRefinementMode,
    previewBranch,
    scoreAndRefine,
    refinePrompt,
    selectRefinement,
    commitExploration,
    cancelRefinement,
  }
}
