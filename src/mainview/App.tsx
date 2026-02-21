import { useState } from "react"
import { ChatBox } from "@/components/ChatBox"
import { PersonaManagement } from "@/components/PersonaManagement"
import { PersonaUIStudio } from "@/components/PersonaUIStudio"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function App() {
  const [view, setView] = useState<"chat" | "studio" | "personas">("chat")

  return (
    <main className={cn("mx-auto min-h-screen space-y-6 p-6", view === "chat" ? "max-w-5xl" : "max-w-3xl")}>
      <div className="flex items-center gap-2">
        <Button size="sm" variant={view === "chat" ? "default" : "ghost"} onClick={() => setView("chat")}>
          Chat
        </Button>
        <Button size="sm" variant={view === "studio" ? "default" : "ghost"} onClick={() => setView("studio")}>
          Persona UI
        </Button>
        <Button size="sm" variant={view === "personas" ? "default" : "ghost"} onClick={() => setView("personas")}>
          Manage Personas
        </Button>
      </div>

      {view === "chat" && <ChatBox />}
      {view === "studio" && <PersonaUIStudio />}
      {view === "personas" && <PersonaManagement />}
    </main>
  )
}

export default App
