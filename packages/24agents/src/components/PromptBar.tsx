import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface PromptBarProps {
  onGenerate: (prompt: string) => void
  onReset: () => void
  isGenerating: boolean
  hasSession: boolean
}

export function PromptBar({ onGenerate, onReset, isGenerating, hasSession }: PromptBarProps) {
  const [prompt, setPrompt] = React.useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return
    onGenerate(prompt.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 p-4 border-b border-border">
      <Input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter your prompt to refine..."
        className="flex-1"
        disabled={isGenerating}
      />
      <Button
        type="submit"
        disabled={!prompt.trim() || isGenerating}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        {isGenerating ? "Generating..." : "Generate"}
      </Button>
      {hasSession && (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onReset()
            setPrompt("")
          }}
          disabled={isGenerating}
        >
          Reset
        </Button>
      )}
    </form>
  )
}
