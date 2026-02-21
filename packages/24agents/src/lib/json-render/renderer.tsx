import { createRenderer } from "@json-render/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { catalog } from "./catalog"

export const PersonaUIRenderer = createRenderer(catalog, {
  Card: ({ element, children }) => (
    <Card>
      <CardHeader>
        <CardTitle>{element.props.title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  ),
  Metric: ({ element }) => (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-muted-foreground text-xs">{element.props.label}</p>
      <p className="text-2xl font-semibold tracking-tight">{element.props.value}</p>
    </div>
  ),
})
