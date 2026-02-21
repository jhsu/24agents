import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PersonaChatWorkspace } from "@/components/PersonaChatWorkspace"
import { BranchingChat } from "@/components/BranchingChat"
import { PersonaManagement } from "@/components/PersonaManagement"

function App() {
  return (
    <Tabs defaultValue="chat" className="flex flex-col h-screen">
      <TabsList className="shrink-0 w-full justify-start rounded-none border-b border-border bg-background px-2">
        <TabsTrigger
          value="chat"
          className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-md"
        >
          Chat
        </TabsTrigger>
        <TabsTrigger
          value="persona-ui"
          className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-md"
        >
          Persona UI
        </TabsTrigger>
        <TabsTrigger
          value="manage"
          className="data-[state=active]:bg-green-600 data-[state=active]:text-white rounded-md"
        >
          Manage Personas
        </TabsTrigger>
      </TabsList>
      <TabsContent value="chat" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
        <PersonaChatWorkspace />
      </TabsContent>
      <TabsContent value="persona-ui" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
        <BranchingChat />
      </TabsContent>
      <TabsContent value="manage" className="flex-1 min-h-0 mt-0 overflow-auto data-[state=inactive]:hidden">
        <PersonaManagement />
      </TabsContent>
    </Tabs>
  )
}

export default App
