import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { Persona } from "@/components/PersonaManagement"
import { loadPersonas, getInitials } from "@/lib/persona"

interface PersonaSelectorProps {
  selectedId: string | null
  onSelect: (persona: Persona | null) => void
}

export function PersonaSelector({ selectedId, onSelect }: PersonaSelectorProps) {
  const [personas, setPersonas] = React.useState<Persona[]>(() => loadPersonas())

  // Refresh personas when dropdown opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setPersonas(loadPersonas())
    }
  }

  const selected = personas.find((p) => p.id === selectedId)

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {selected ? (
            <>
              <Avatar size="sm" className="h-5 w-5">
                <AvatarFallback className="text-[10px]">
                  {getInitials(selected.name)}
                </AvatarFallback>
              </Avatar>
              {selected.name}
            </>
          ) : (
            "No Persona"
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onSelect(null)}>
          No Persona
        </DropdownMenuItem>
        {personas.length > 0 && <DropdownMenuSeparator />}
        {personas.map((persona) => (
          <DropdownMenuItem
            key={persona.id}
            onClick={() => onSelect(persona)}
            className="gap-2"
          >
            <Avatar size="sm" className="h-5 w-5">
              <AvatarFallback className="text-[10px]">
                {getInitials(persona.name)}
              </AvatarFallback>
            </Avatar>
            {persona.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
