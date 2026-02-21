import * as React from "react"
import { useChatUI } from "@json-render/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Persona, loadPersonas } from "@/components/PersonaManagement"
import { PersonaUIRenderer } from "@/lib/json-render/renderer"

const PERSONA_UI_API = "http://localhost:4000/api/persona-ui"
const HEALTH_API = "http://localhost:4000/health"

function getGenerationPrompt(persona: Persona): string {
  return [
    `Generate a compact UI for configuring this persona.`,
    `Persona name: ${persona.name}`,
    `Persona description: ${persona.description || "(none)"}`,
    `Use only Card and Metric components.`,
  ].join("\n")
}

export function PersonaUIStudio() {
  const [personas, setPersonas] = React.useState<Persona[]>(() => loadPersonas())
  const [selectedPersonaId, setSelectedPersonaId] = React.useState<string>("")
  const [healthStatus, setHealthStatus] = React.useState<string>("")
  const [isCheckingHealth, setIsCheckingHealth] = React.useState(false)

  const { messages, isStreaming, error, send, clear } = useChatUI({
    api: PERSONA_UI_API,
  })

  React.useEffect(() => {
    const all = loadPersonas()
    setPersonas(all)

    if (!selectedPersonaId && all.length > 0) {
      setSelectedPersonaId(all[0].id)
      return
    }

    if (selectedPersonaId && !all.some((persona) => persona.id === selectedPersonaId)) {
      setSelectedPersonaId(all[0]?.id ?? "")
    }
  }, [selectedPersonaId])

  const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId) ?? null

  const latestSpec = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (message.role === "assistant" && message.spec) {
        return message.spec
      }
    }
    return null
  }, [messages])

  const handleGenerate = async () => {
    if (!selectedPersona) return
    await send(getGenerationPrompt(selectedPersona))
  }

  const handleHealthCheck = async () => {
    setIsCheckingHealth(true)
    setHealthStatus("")

    try {
      const response = await fetch(HEALTH_API)
      const text = await response.text()

      if (!response.ok) {
        setHealthStatus(`Health check failed (${response.status}): ${text || response.statusText}`)
        return
      }

      setHealthStatus(`Health check OK: ${text || "(empty response)"}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setHealthStatus(`Health check error: ${message}`)
    } finally {
      setIsCheckingHealth(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Persona UI Generator</CardTitle>
          <CardDescription>
            Select a persona and generate a json-render UI from <code>/api/persona-ui</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" htmlFor="persona-select">
              Persona
            </label>
            <select
              id="persona-select"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedPersonaId}
              onChange={(e) => setSelectedPersonaId(e.target.value)}
              disabled={personas.length === 0 || isStreaming}
            >
              {personas.length === 0 ? (
                <option value="">No personas found</option>
              ) : (
                personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleGenerate} disabled={!selectedPersona || isStreaming}>
              {isStreaming ? "Generating..." : "Generate UI"}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleHealthCheck} disabled={isCheckingHealth}>
              {isCheckingHealth ? "Checking..." : "Test /health"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              disabled={isStreaming || messages.length === 0}
            >
              Clear
            </Button>
          </div>

          {error && <p className="text-destructive text-xs">{error.message}</p>}
          {healthStatus && <p className="text-xs text-muted-foreground">{healthStatus}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated UI</CardTitle>
          <CardDescription>Live render of the latest assistant spec</CardDescription>
        </CardHeader>
        <CardContent>
          {latestSpec ? (
            <PersonaUIRenderer spec={latestSpec} loading={isStreaming} />
          ) : (
            <p className="text-muted-foreground text-xs">Generate a persona UI to preview it here.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
