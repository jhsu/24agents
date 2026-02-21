import { query } from "@anthropic-ai/claude-agent-sdk";

export async function startServer() {
  return Bun.serve({
    port: 4000,
    routes: {
      "/health": () => new Response("OK"),
      "/api/chat": {
        POST: async (req) => {
          let body: { prompt?: string; allowedTools?: string[] };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }

          const { prompt, allowedTools } = body;
          if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
            return Response.json({ error: "prompt is required" }, { status: 400 });
          }

          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              const send = (data: unknown) => {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                );
              };

              try {
                const options =
                  allowedTools !== undefined ? { allowedTools } : {};
                for await (const message of query({ prompt, options })) {
                  send(message);
                }
              } catch (error) {
                send({ type: "error", error: String(error) });
              } finally {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        },
      },
    },
    development: {
      hmr: true,
      console: true,
    },
  });
}