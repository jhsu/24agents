import { useState, useCallback } from "react"
import {
  type PromptSession,
  type Iteration,
  type PersonaPath,
  createSession,
  addIteration,
  saveSession,
} from "@/lib/iteration"
import { rewritePrompt, fetchPersonaPaths } from "@/lib/sse-client"
import { loadPersonas, serializePersona, getInitials } from "@/lib/persona"
import type { Persona } from "@/components/PersonaManagement"

export function usePromptSession() {
  const [session, setSession] = useState<PromptSession | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [personaPaths, setPersonaPaths] = useState<PersonaPath[]>([])
  const [isLoadingPaths, setIsLoadingPaths] = useState(false)

  const persist = useCallback((updated: PromptSession) => {
    setSession(updated)
    saveSession(updated)
  }, [])

  const loadPaths = useCallback(async (prompt: string) => {
    const personas = loadPersonas()
    if (personas.length === 0) return

    setIsLoadingPaths(true)
    try {
      const paths = await fetchPersonaPaths(
        prompt,
        personas.map((p) => ({ id: p.id, name: p.name, description: p.description })),
      )
      // Ensure initials are set
      const withInitials = paths.map((p) => ({
        ...p,
        initials: p.initials || getInitials(p.personaName),
      }))
      setPersonaPaths(withInitials)
    } catch (err) {
      console.error("Failed to load persona paths:", err)
      // Fallback to basic paths from local personas
      const personas = loadPersonas()
      setPersonaPaths(
        personas.map((p) => ({
          personaId: p.id,
          personaName: p.name,
          initials: getInitials(p.name),
          description: `Would refine this prompt from a ${p.name.toLowerCase()} perspective.`,
        })),
      )
    } finally {
      setIsLoadingPaths(false)
    }
  }, [])

  const startSession = useCallback(
    async (prompt: string) => {
      const newSession = createSession(prompt)
      persist(newSession)
      await loadPaths(prompt)
    },
    [persist, loadPaths],
  )

  const followPersona = useCallback(
    async (path: PersonaPath) => {
      if (!session || isGenerating) return

      setIsGenerating(true)
      try {
        const personas = loadPersonas()
        const persona = personas.find((p: Persona) => p.id === path.personaId)
        const personaPrompt = persona
          ? serializePersona(persona)
          : `You are ${path.personaName}. ${path.description}`

        // Determine the prompt to refine
        const currentIteration = session.currentIterationId
          ? session.iterations.find((i) => i.id === session.currentIterationId)
          : null
        const promptToRefine = currentIteration
          ? currentIteration.refinedPrompt
          : session.originalPrompt

        const iterationContext = currentIteration
          ? `Previous refined prompt by ${currentIteration.personaName}: "${currentIteration.refinedPrompt}"\nScore: C=${currentIteration.score.C} F=${currentIteration.score.F} N=${currentIteration.score.N} R=${currentIteration.score.R}`
          : undefined

        const result = await rewritePrompt(promptToRefine, personaPrompt, iterationContext)

        const iteration: Iteration = {
          id: crypto.randomUUID(),
          personaId: path.personaId,
          personaName: path.personaName,
          refinedPrompt: result.refinedPrompt,
          responseText: result.responseText,
          score: result.score,
          parentIterationId: session.currentIterationId,
          createdAt: Date.now(),
        }

        const updated = addIteration(session, iteration)
        persist(updated)

        // Load new paths for the refined prompt
        await loadPaths(result.refinedPrompt)
      } catch (err) {
        console.error("Follow persona failed:", err)
      } finally {
        setIsGenerating(false)
      }
    },
    [session, isGenerating, persist, loadPaths],
  )

  const continueFromIteration = useCallback(
    async (iterationId: string) => {
      if (!session) return

      const iteration = session.iterations.find((i) => i.id === iterationId)
      if (!iteration) return

      const updated = { ...session, currentIterationId: iterationId }
      persist(updated)
      await loadPaths(iteration.refinedPrompt)
    },
    [session, persist, loadPaths],
  )

  const reset = useCallback(() => {
    setSession(null)
    setPersonaPaths([])
    setIsGenerating(false)
    setIsLoadingPaths(false)
  }, [])

  return {
    session,
    isGenerating,
    personaPaths,
    isLoadingPaths,
    startSession,
    followPersona,
    continueFromIteration,
    reset,
  }
}
