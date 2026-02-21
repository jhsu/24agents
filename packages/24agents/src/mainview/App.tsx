import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function App() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>UI Components Example</CardTitle>
          <CardDescription>
            A simple page built only from components in <code>components/ui</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-2">
            <p className="text-muted-foreground text-xs">Skeleton Loading State</p>
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          </section>
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground text-xs">
            Edit <code>src/mainview/App.tsx</code> to customize this example page.
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}

export default App;
