import * as React from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { cn } from "@/lib/utils"

interface DemoPersona {
  id: string
  name: string
  definition: string
  commentary: string
  promptSuggestion: string
  generatedResponse: string[]
}

const DEFAULT_USER_PROMPT = "I want to build an ai agent orchestrator"

const DEMO_PERSONAS: DemoPersona[] = [
  {
    id: "software-engineer",
    name: "Software Engineer",
    definition: "Pragmatic systems builder focused on architecture, reliability, and implementation details.",
    commentary:
      "I'd rewrite this prompt to force concrete system boundaries, interfaces, and a first buildable version.",
    promptSuggestion:
      "Design an AI agent orchestrator architecture for Bun + TypeScript with a supervisor agent, task queue, memory layer, and failure recovery. Include component interfaces and a step-by-step MVP implementation plan.",
    generatedResponse: [
      "Define four services: Orchestrator API, Agent Runtime, Memory Store, and Observability.",
      "Start with one supervisor and two worker agents before expanding to dynamic agent routing.",
      "Use typed task contracts and retries with idempotency keys for safe re-execution.",
    ],
  },
  {
    id: "product-manager",
    name: "Product Manager",
    definition: "Outcome-driven planner focused on user value, scope, and measurable success criteria.",
    commentary:
      "I'd rewrite this prompt around user jobs, launch scope, and decision-making metrics so we ship the right first version.",
    promptSuggestion:
      "Create a product plan for an AI agent orchestrator that helps teams coordinate specialized agents. Define target users, top 3 use cases, MVP scope, and success metrics for a 6-week beta.",
    generatedResponse: [
      "Target user: AI builders who need predictable multi-agent workflows without custom glue code.",
      "MVP use cases: research synthesis, code task delegation, and execution audit trails.",
      "Success metrics: time-to-first-workflow < 15 minutes and 70% weekly active workflow completion.",
    ],
  },
  {
    id: "designer",
    name: "Designer",
    definition: "Experience strategist focused on usability, clarity, trust, and human-in-the-loop controls.",
    commentary:
      "I'd rewrite this prompt to prioritize interaction design: how people understand agent decisions and safely intervene.",
    promptSuggestion:
      "Design the user experience for an AI agent orchestrator dashboard showing active agents, task progress, handoffs, and intervention controls. Include information hierarchy and trust-building UX principles.",
    generatedResponse: [
      "Primary layout: live workflow timeline on the left, agent panel on the right, intervention drawer at bottom.",
      "Expose why each handoff happened with plain-language rationale and confidence indicators.",
      "Add one-click pause, reroute, and approve controls to keep humans confidently in control.",
    ],
  },
]

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function buildGeneratedResponse(originalPrompt: string, revisedPrompt: string, persona: DemoPersona): string {
  const bulletLines = persona.generatedResponse.map((line) => `- ${line}`)

  return [
    `Original prompt: ${originalPrompt}`,
    "",
    `Followed persona: ${persona.name}`,
    `Persona definition: ${persona.definition}`,
    "",
    "Revised prompt used for generation:",
    revisedPrompt,
    "",
    "Generated response:",
    ...bulletLines,
  ].join("\n")
}

export function ChatBox() {
  const [input, setInput] = React.useState(DEFAULT_USER_PROMPT)
  const [selectedPersonaId, setSelectedPersonaId] = React.useState("")
  const [originalPrompt, setOriginalPrompt] = React.useState(DEFAULT_USER_PROMPT)
  const [generatedResponse, setGeneratedResponse] = React.useState(
    "Select a persona path on the right to revise the prompt and generate a response."
  )

  const handleGenerate = () => {
    const revisedPrompt = input.trim()
    if (!revisedPrompt) return

    const selectedPersona = DEMO_PERSONAS.find((persona) => persona.id === selectedPersonaId)

    if (!selectedPersona) {
      setGeneratedResponse("Choose a persona path first so the prompt can be revised before generation.")
      return
    }

    setGeneratedResponse(buildGeneratedResponse(originalPrompt, revisedPrompt, selectedPersona))
  }

  const handleFollowPersona = (persona: DemoPersona) => {
    const basePrompt = input.trim() || originalPrompt

    setSelectedPersonaId(persona.id)
    setOriginalPrompt(basePrompt)
    setInput(persona.promptSuggestion)
    setGeneratedResponse(buildGeneratedResponse(basePrompt, persona.promptSuggestion, persona))
  }

  const selectedPersona = DEMO_PERSONAS.find((persona) => persona.id === selectedPersonaId)

  const handleResetDemo = () => {
    setSelectedPersonaId("")
    setOriginalPrompt(DEFAULT_USER_PROMPT)
    setInput(DEFAULT_USER_PROMPT)
    setGeneratedResponse("Select a persona path on the right to revise the prompt and generate a response.")
  }

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader className="border-b">
        <CardTitle className="text-base">Persona Chat Workspace</CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleGenerate()
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <Input
            placeholder="Enter your prompt..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="h-10"
          />
          <Button type="submit" className="h-10 sm:w-28">
            Generate
          </Button>
          <Button type="button" variant="outline" className="h-10 sm:w-32" onClick={handleResetDemo}>
            Reset Demo
          </Button>
        </form>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="min-h-[340px] rounded-md border bg-muted/20 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Generated Response
            </div>
            <div className="text-sm whitespace-pre-line leading-relaxed">{generatedResponse}</div>
          </section>

          <section className="rounded-md border bg-muted/20 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Persona Paths to Follow
            </div>
            <div className="space-y-3">
              {DEMO_PERSONAS.map((persona) => {
                const isActive = persona.id === selectedPersonaId

                return (
                  <div
                    key={persona.id}
                    className={cn(
                      "rounded-md border p-3 transition-colors",
                      isActive ? "border-primary bg-primary/10" : "border-border"
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback>{getInitials(persona.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{persona.name}</span>
                    </div>
                    <p className="mb-2 text-xs text-muted-foreground">{persona.commentary}</p>
                    <p className="mb-3 text-xs text-muted-foreground">Suggestion: {persona.promptSuggestion}</p>
                    <Button type="button" size="sm" variant={isActive ? "default" : "outline"} onClick={() => handleFollowPersona(persona)}>
                      {isActive ? "Following Persona" : "Follow Persona"}
                    </Button>
                  </div>
                )
              })}
            </div>
            {selectedPersona && (
              <p className="mt-3 text-xs text-muted-foreground">Active path: {selectedPersona.name}</p>
            )}
          </section>
        </div>
      </CardContent>
    </Card>
  )
}
