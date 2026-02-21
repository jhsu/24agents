import * as React from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
} from "@/components/ui/dialog"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { serializePersona, getInitials, loadPersonas, savePersonas } from "@/lib/persona"

export interface Persona {
  id: string
  name: string
  description: string
  createdAt: number
}

interface PersonaFormValues {
  name: string
  description: string
}

interface PersonaFormProps {
  initialValues?: PersonaFormValues
  onSubmit: (values: PersonaFormValues) => void
  onCancel: () => void
  submitLabel: string
}

function PersonaForm({ initialValues, onSubmit, onCancel, submitLabel }: PersonaFormProps) {
  const [name, setName] = React.useState(initialValues?.name ?? "")
  const [description, setDescription] = React.useState(initialValues?.description ?? "")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({ name: name.trim(), description: description.trim() })
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogBody>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" htmlFor="persona-name">
            Name
          </label>
          <Input
            id="persona-name"
            placeholder="e.g. Skeptical Engineer"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" htmlFor="persona-description">
            Description
          </label>
          <Textarea
            id="persona-description"
            placeholder="Describe this persona's perspective, expertise, and communication style..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>
        {name.trim() && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Preview (serialized for AI)</p>
            <pre className="bg-muted rounded-md p-3 text-xs/relaxed whitespace-pre-wrap font-mono">
              {serializePersona({
                id: "",
                name: name.trim(),
                description: description.trim(),
                createdAt: Date.now(),
              })}
            </pre>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!name.trim()}>
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}

interface PersonaCardProps {
  persona: Persona
  onEdit: (persona: Persona) => void
  onDelete: (id: string) => void
  onCopy: (persona: Persona) => void
}

function PersonaCard({ persona, onEdit, onDelete, onCopy }: PersonaCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback>{getInitials(persona.name)}</AvatarFallback>
          </Avatar>
          <CardTitle>{persona.name}</CardTitle>
        </div>
        <CardAction>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCopy(persona)}
              title="Copy prompt"
            >
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(persona)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(persona.id)}
              className="text-destructive hover:text-destructive"
            >
              Delete
            </Button>
          </div>
        </CardAction>
        {persona.description && (
          <CardDescription>{persona.description}</CardDescription>
        )}
      </CardHeader>
    </Card>
  )
}

export function PersonaManagement() {
  const [personas, setPersonas] = React.useState<Persona[]>(() => loadPersonas())
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editingPersona, setEditingPersona] = React.useState<Persona | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)

  const updatePersonas = (next: Persona[]) => {
    setPersonas(next)
    savePersonas(next)
  }

  const handleCreate = (values: PersonaFormValues) => {
    const persona: Persona = {
      id: crypto.randomUUID(),
      name: values.name,
      description: values.description,
      createdAt: Date.now(),
    }
    updatePersonas([...personas, persona])
    setCreateOpen(false)
  }

  const handleEdit = (values: PersonaFormValues) => {
    if (!editingPersona) return
    updatePersonas(
      personas.map((p) =>
        p.id === editingPersona.id ? { ...p, ...values } : p
      )
    )
    setEditingPersona(null)
  }

  const handleDelete = (id: string) => {
    updatePersonas(personas.filter((p) => p.id !== id))
  }

  const handleCopy = async (persona: Persona) => {
    const text = serializePersona(persona)
    await navigator.clipboard.writeText(text)
    setCopiedId(persona.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Personas</h2>
          <p className="text-muted-foreground text-xs">
            Manage AI personas to guide explorations
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          New Persona
        </Button>
      </div>

      {personas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-xs">
              No personas yet. Create one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {personas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              onEdit={setEditingPersona}
              onDelete={handleDelete}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}

      {copiedId && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground shadow-md">
          Prompt copied to clipboard
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Persona</DialogTitle>
            <DialogDescription>
              Create a persona to use as an AI voice during explorations.
            </DialogDescription>
          </DialogHeader>
          <PersonaForm
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
            submitLabel="Create"
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingPersona !== null}
        onOpenChange={(open) => { if (!open) setEditingPersona(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Persona</DialogTitle>
            <DialogDescription>
              Update this persona's name and description.
            </DialogDescription>
          </DialogHeader>
          {editingPersona && (
            <PersonaForm
              key={editingPersona.id}
              initialValues={{
                name: editingPersona.name,
                description: editingPersona.description,
              }}
              onSubmit={handleEdit}
              onCancel={() => setEditingPersona(null)}
              submitLabel="Save"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
