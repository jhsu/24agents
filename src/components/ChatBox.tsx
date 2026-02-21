import * as React from "react"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Textarea } from "./ui/textarea"
import { cn } from "@/lib/utils"

interface Persona {
  id: string
  name: string
  definition: string
  suggestion: string
  points: number
  fired: boolean
}

interface EvaluationResult {
  criterion: string
  score: number
  note: string
}

const API_BASE = "http://localhost:4000"
const DEFAULT_PROMPT = "I want to build an ai agent orchestrator"
const DEFAULT_CRITERIA = "clarity, feasibility, novelty, user value"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function parseCriteria(criteriaRaw: string): string[] {
  return criteriaRaw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

async function fetchJson<T>(path: string, init?: RequestInit, label?: string): Promise<T> {
  const requestLabel = label ?? path
  console.debug(`[ChatBox] Request start: ${requestLabel}`, {
    method: init?.method ?? "GET",
    path,
  })

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`[ChatBox] Request failed: ${requestLabel}`, {
      status: response.status,
      body: text,
    })
    throw new Error(text || `Request failed (${response.status})`)
  }

  const data = await response.json() as T
  console.debug(`[ChatBox] Request success: ${requestLabel}`, {
    status: response.status,
  })
  return data
}

export function ChatBox() {
  const [sessionId, setSessionId] = React.useState<string | null>(null)
  const [personas, setPersonas] = React.useState<Persona[]>([])
  const [selectedPersonaIds, setSelectedPersonaIds] = React.useState<string[]>([])
  const [basePrompt, setBasePrompt] = React.useState(DEFAULT_PROMPT)
  const [revisedPrompt, setRevisedPrompt] = React.useState(DEFAULT_PROMPT)
  const [criteria, setCriteria] = React.useState(DEFAULT_CRITERIA)
  const [promptGuidance, setPromptGuidance] = React.useState("")
  const [generatedResponse, setGeneratedResponse] = React.useState(
    "Select one or more personas, submit your prompt, then generate response."
  )
  const [evaluationResults, setEvaluationResults] = React.useState<EvaluationResult[]>([])
  const [overallScore, setOverallScore] = React.useState<number | null>(null)
  const [error, setError] = React.useState("")

  const [isLoadingPersonas, setIsLoadingPersonas] = React.useState(true)
  const [isSubmittingPrompt, setIsSubmittingPrompt] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [isExtracting, setIsExtracting] = React.useState(false)
  const [firingPersonaId, setFiringPersonaId] = React.useState<string | null>(null)

  const loadPersonas = React.useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoadingPersonas(true)

    try {
      const data = await fetchJson<{ personas: Persona[] }>("/api/personas", undefined, "loadPersonas")
      const active = data.personas.filter((persona) => !persona.fired)
      setPersonas(active)
      setSelectedPersonaIds((current) => current.filter((id) => active.some((persona) => persona.id === id)))
    } finally {
      if (showLoader) setIsLoadingPersonas(false)
    }
  }, [])

  const ensureSession = React.useCallback(async () => {
    if (sessionId) return sessionId

    const created = await fetchJson<{ sessionId: string }>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ initialPrompt: basePrompt.trim() || DEFAULT_PROMPT }),
    }, "createSession")
    setSessionId(created.sessionId)
    return created.sessionId
  }, [basePrompt, sessionId])

  const syncSelectedPersonas = React.useCallback(
    async (nextSelected: string[]) => {
      const id = await ensureSession()
      await fetchJson<{ sessionId: string; selectedPersonaIds: string[] }>("/api/personas/select", {
        method: "POST",
        body: JSON.stringify({ sessionId: id, personaIds: nextSelected }),
      }, "syncSelectedPersonas")
    },
    [ensureSession]
  )

  React.useEffect(() => {
    void loadPersonas()
  }, [loadPersonas])

  const handlePersonaSelection = (personaId: string) => {
    const next = selectedPersonaIds.includes(personaId)
      ? selectedPersonaIds.filter((id) => id !== personaId)
      : [...selectedPersonaIds, personaId]

    setSelectedPersonaIds(next)
    void syncSelectedPersonas(next).catch((err) => {
      setError(`Could not sync persona selection: ${String(err)}`)
    })
  }

  const handleRegeneratePrompt = async () => {
    setError("")
    setIsSubmittingPrompt(true)
    console.debug("[ChatBox] Submit prompt", {
      basePrompt,
      selectedPersonaIds,
      hasPromptGuidance: Boolean(promptGuidance.trim()),
    })

    try {
      const id = await ensureSession()
      const revised = await fetchJson<{ revisedPrompt: string }>("/api/prompts/revise", {
        method: "POST",
        body: JSON.stringify({
          sessionId: id,
          userPrompt: basePrompt.trim() || DEFAULT_PROMPT,
          selectedPersonaIds,
          prependedInstructions: promptGuidance.trim() || undefined,
        }),
      }, "revisePrompt")

      setRevisedPrompt(revised.revisedPrompt)

      if (selectedPersonaIds.length > 0) {
        await fetchJson<{ updated: Persona[] }>("/api/personas/points/increment", {
          method: "POST",
          body: JSON.stringify({
            personaIds: selectedPersonaIds,
            reason: "prompt_regeneration",
          }),
        }, "incrementPersonaPoints")
        await loadPersonas(false)
      }
    } catch (err) {
      setError(`Could not regenerate prompt: ${String(err)}`)
      console.error("[ChatBox] handleRegeneratePrompt failed", err)
    } finally {
      setIsSubmittingPrompt(false)
    }
  }

  const handleGenerate = async () => {
    setError("")
    setIsGenerating(true)
    console.debug("[ChatBox] Generate + evaluate", {
      selectedPersonaIds,
      criteria,
    })

    try {
      const id = await ensureSession()
      const promptToUse = revisedPrompt.trim() || basePrompt.trim() || DEFAULT_PROMPT
      const generated = await fetchJson<{ responseText: string }>("/api/responses/generate", {
        method: "POST",
        body: JSON.stringify({
          sessionId: id,
          revisedPrompt: promptToUse,
          selectedPersonaIds,
        }),
      }, "generateResponse")

      setGeneratedResponse(generated.responseText)

      const evaluation = await fetchJson<{ results: EvaluationResult[]; overallScore: number }>(
        "/api/evaluations/run",
        {
          method: "POST",
          body: JSON.stringify({
            sessionId: id,
            responseText: generated.responseText,
            criteria: parseCriteria(criteria),
          }),
        },
        "runEvaluation"
      )

      setEvaluationResults(evaluation.results)
      setOverallScore(evaluation.overallScore)
    } catch (err) {
      setError(`Could not generate and evaluate: ${String(err)}`)
      console.error("[ChatBox] handleGenerate failed", err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExtractInsights = async () => {
    if (!generatedResponse.trim()) return

    setError("")
    setIsExtracting(true)
    console.debug("[ChatBox] Extract insights", {
      selectedPersonaIds,
      criteria,
      evalCount: evaluationResults.length,
    })

    try {
      const id = await ensureSession()
      const extracted = await fetchJson<{ extractedInstructions: string }>("/api/insights/extract", {
        method: "POST",
        body: JSON.stringify({
          sessionId: id,
          responseText: generatedResponse,
          criteria: parseCriteria(criteria),
          selectedPersonaIds,
          evaluationResults,
        }),
      }, "extractInsights")

      setPromptGuidance(extracted.extractedInstructions)
    } catch (err) {
      setError(`Could not extract insights: ${String(err)}`)
      console.error("[ChatBox] handleExtractInsights failed", err)
    } finally {
      setIsExtracting(false)
    }
  }

  const handleFirePersona = async (personaId: string) => {
    setError("")
    setFiringPersonaId(personaId)

    try {
      await fetchJson<{ persona: Persona }>("/api/personas/fire", {
        method: "POST",
        body: JSON.stringify({ personaId }),
      }, "firePersona")

      const nextSelected = selectedPersonaIds.filter((id) => id !== personaId)
      setSelectedPersonaIds(nextSelected)
      await syncSelectedPersonas(nextSelected)
      await loadPersonas(false)
    } catch (err) {
      setError(`Could not fire persona: ${String(err)}`)
      console.error("[ChatBox] handleFirePersona failed", err)
    } finally {
      setFiringPersonaId(null)
    }
  }

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader className="border-b">
        <CardTitle className="text-base">Persona-Guided Idea Exploration</CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 p-4">
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Instructions Prepended to Future Prompts
          </div>
          <Textarea
            value={promptGuidance}
            onChange={(event) => setPromptGuidance(event.target.value)}
            rows={5}
            placeholder="Extracted insights will appear here and get prepended during prompt regeneration."
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">User Prompt</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={basePrompt} onChange={(event) => setBasePrompt(event.target.value)} />
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleRegeneratePrompt()}
              className="sm:w-48"
              disabled={isSubmittingPrompt}
            >
              {isSubmittingPrompt ? "Submitting..." : "Submit User Prompt"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="space-y-4 rounded-md border bg-muted/20 p-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revised Prompt</div>
              <Textarea value={revisedPrompt} onChange={(event) => setRevisedPrompt(event.target.value)} rows={8} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleRegeneratePrompt()}
                disabled={isSubmittingPrompt}
              >
                {isSubmittingPrompt ? "Regenerating..." : "Regenerate Prompt from Selected Personas"}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evaluation Criteria</div>
              <Textarea
                value={criteria}
                onChange={(event) => setCriteria(event.target.value)}
                rows={3}
                placeholder="e.g. clarity, feasibility, novelty, user value"
              />
            </div>

            <Button type="button" onClick={() => void handleGenerate()} disabled={isGenerating}>
              {isGenerating ? "Generating + Evaluating..." : "Generate Response + Evaluate"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleExtractInsights()}
              disabled={evaluationResults.length === 0 || isExtracting}
            >
              {isExtracting ? "Extracting..." : "Extract Insights for Future Prompts"}
            </Button>

            <div className="rounded-md border bg-background/60 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Generated Response</div>
              <div className="text-sm whitespace-pre-line leading-relaxed">{generatedResponse}</div>
            </div>

            <div className="rounded-md border bg-background/60 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evaluation</div>
              {overallScore !== null && (
                <div className="mb-2 text-xs font-medium">Overall: {overallScore}/10</div>
              )}
              {evaluationResults.length === 0 ? (
                <div className="text-xs text-muted-foreground">No evaluation yet. Generate first.</div>
              ) : (
                <div className="space-y-2">
                  {evaluationResults.map((result) => (
                    <div key={result.criterion} className="rounded-md border p-2">
                      <div className="text-xs font-medium">
                        {result.criterion}: {result.score}/10
                      </div>
                      <div className="text-[11px] text-muted-foreground">{result.note}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-md border bg-muted/20 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Personas (Multi-Select)
            </div>
            <div className="space-y-3">
              {isLoadingPersonas ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Loading personas...</div>
              ) : personas.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  No active personas left. Rehire one through API to continue.
                </div>
              ) : personas.map((persona) => {
                const isSelected = selectedPersonaIds.includes(persona.id)
                const isFiring = firingPersonaId === persona.id

                return (
                  <div key={persona.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handlePersonaSelection(persona.id)}
                      className={cn(
                        "w-full rounded-md border p-3 text-left transition-colors",
                        isSelected ? "border-primary bg-primary/10" : "border-border"
                      )}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback>{getInitials(persona.name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{persona.name}</span>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {persona.points} pts
                        </span>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {isSelected ? "selected" : "not selected"}
                        </span>
                      </div>
                      <p className="mb-3 text-xs text-muted-foreground">{persona.suggestion}</p>
                      <span className="text-[11px] text-muted-foreground">Click to toggle selection (multi-select enabled).</span>
                    </button>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void handleFirePersona(persona.id)}
                        disabled={isFiring}
                      >
                        {isFiring ? "Firing..." : "Fire"}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  )
}
