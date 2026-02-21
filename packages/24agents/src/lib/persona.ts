import type { Persona } from "@/components/PersonaManagement"

export function serializePersona(persona: Persona): string {
  const initials = persona.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return [
    `Persona: ${persona.name}`,
    `Initials: ${initials}`,
    `Description: ${persona.description}`,
    "",
    `Instructions: You are ${persona.name}. ${persona.description}`,
    "When exploring ideas, provide commentary from this persona's perspective and suggest relevant paths to explore.",
  ].join("\n")
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const STORAGE_KEY = "24agents:personas"

export function loadPersonas(): Persona[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function savePersonas(personas: Persona[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(personas))
}
