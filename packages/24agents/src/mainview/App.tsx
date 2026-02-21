import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExploreView } from "@/components/ExploreView"
import { PersonaManagement } from "@/components/PersonaManagement"
import { Compass, Settings } from "lucide-react"

function App() {
  return (
    <Tabs defaultValue="explore" className="flex flex-col h-screen">
      <TabsList className="shrink-0 w-full justify-start rounded-none border-b border-border bg-background px-3 py-1.5 gap-1">
        <TabsTrigger
          value="explore"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-green-600/25 data-[state=inactive]:hover:bg-muted/50 data-[state=inactive]:hover:text-foreground"
        >
          <Compass className="h-4 w-4" />
          Explore
        </TabsTrigger>
        <TabsTrigger
          value="manage"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-green-600/25 data-[state=inactive]:hover:bg-muted/50 data-[state=inactive]:hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
          Manage Personas
        </TabsTrigger>
      </TabsList>
      <TabsContent value="explore" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
        <ExploreView />
      </TabsContent>
      <TabsContent value="manage" className="flex-1 min-h-0 mt-0 overflow-auto data-[state=inactive]:hidden">
        <PersonaManagement />
      </TabsContent>
    </Tabs>
  )
}

export default App
