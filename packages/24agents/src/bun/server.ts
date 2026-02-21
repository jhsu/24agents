import Anthropic from "@anthropic-ai/sdk";

// Electrobun runs from a different CWD, so .env.local may not auto-load.
// Try multiple known locations to find the env file.
async function loadEnvLocal() {
  if (process.env.ANTHROPIC_API_KEY) return; // Already loaded

  // Electrobun bundles into build/dev-macos-arm64/app.app/Contents/Resources/app/bun/
  // Walk up from import.meta.dir to find .env.local
  const candidates: string[] = [];
  let dir = import.meta.dir;
  for (let i = 0; i < 10; i++) {
    candidates.push(`${dir}/.env.local`);
    const parent = dir.replace(/\/[^/]+$/, "");
    if (parent === dir) break;
    dir = parent;
  }
  // Also try CWD
  candidates.push(`${process.cwd()}/.env.local`);

  for (const path of candidates) {
    try {
      const file = Bun.file(path);
      if (await file.exists()) {
        const text = await file.text();
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIdx = trimmed.indexOf("=");
          if (eqIdx === -1) continue;
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
        console.log(`Loaded env from: ${path}`);
        return;
      }
    } catch { /* skip */ }
  }
  console.warn("WARNING: Could not find .env.local — ANTHROPIC_API_KEY may be missing");
}
await loadEnvLocal();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-20250514";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function startServer() {
  return Bun.serve({
    port: 4000,
    fetch(req) {
      // Handle CORS preflight for any route
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }
      return undefined; // fall through to routes
    },
    routes: {
      "/health": () => new Response("OK", { headers: CORS_HEADERS }),
      "/api/chat": {
        POST: async (req) => {
          let body: {
            prompt?: string;
            history?: { role: string; content: string }[];
            systemPrompt?: string;
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
          }

          const { prompt, history, systemPrompt } = body;
          if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
            return Response.json({ error: "prompt is required" }, { status: 400, headers: CORS_HEADERS });
          }

          // Build messages array from history + new prompt
          const messages: { role: "user" | "assistant"; content: string }[] = [];
          if (history && history.length > 0) {
            for (const msg of history) {
              messages.push({
                role: msg.role as "user" | "assistant",
                content: msg.content,
              });
            }
          }
          messages.push({ role: "user", content: prompt });

          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              try {
                const apiStream = client.messages.stream({
                  model: MODEL,
                  max_tokens: 4096,
                  system: systemPrompt || undefined,
                  messages,
                });

                for await (const event of apiStream) {
                  if (
                    event.type === "content_block_delta" &&
                    event.delta.type === "text_delta"
                  ) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: "text", text: event.delta.text })}\n\n`
                      )
                    );
                  }
                }
              } catch (error) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "error", error: String(error) })}\n\n`
                  )
                );
              } finally {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: {
              ...CORS_HEADERS,
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        },
      },
      "/api/chat/branches": {
        POST: async (req) => {
          let body: {
            conversationContext?: { role: string; content: string }[];
            currentResponse?: string;
            personaPrompt?: string;
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
          }

          const { conversationContext, currentResponse, personaPrompt } = body;
          if (!currentResponse) {
            return Response.json({ error: "currentResponse is required" }, { status: 400, headers: CORS_HEADERS });
          }

          const messages: { role: "user" | "assistant"; content: string }[] = [];
          if (conversationContext && conversationContext.length > 0) {
            for (const msg of conversationContext) {
              messages.push({
                role: msg.role as "user" | "assistant",
                content: msg.content,
              });
            }
          }

          messages.push({
            role: "user",
            content: `The latest assistant response was:\n${currentResponse}\n\nBased on this conversation, suggest exactly 3 interesting branching paths the user could explore next. Each branch should be a distinct direction for the conversation.\n\nReturn ONLY a JSON array with exactly 3 objects, each having "id" (unique string), "label" (short 3-6 word title), and "description" (one sentence explaining the direction). No other text, just the JSON array.`,
          });

          const systemPrompt = personaPrompt
            ? `${personaPrompt}\n\nYou are helping suggest branching conversation paths.`
            : "You are helping suggest branching conversation paths.";

          try {
            const response = await client.messages.create({
              model: MODEL,
              max_tokens: 1024,
              system: systemPrompt,
              messages,
            });

            let fullResult = "";
            for (const block of response.content) {
              if (block.type === "text") {
                fullResult += block.text;
              }
            }

            const jsonMatch = fullResult.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const branches = JSON.parse(jsonMatch[0]);
              if (Array.isArray(branches) && branches.length > 0) {
                const validated = branches.slice(0, 3).map((b: Record<string, string>, i: number) => ({
                  id: b.id || crypto.randomUUID(),
                  label: b.label || `Path ${i + 1}`,
                  description: b.description || "",
                }));
                return Response.json({ branches: validated }, { headers: CORS_HEADERS });
              }
            }

            return Response.json({
              branches: defaultBranches(),
            }, { headers: CORS_HEADERS });
          } catch (error) {
            console.error("Branch generation error:", error);
            return Response.json({
              branches: defaultBranches(),
            }, { headers: CORS_HEADERS });
          }
        },
      },
    },
    development: {
      hmr: true,
      console: true,
    },
  });
}

function defaultBranches() {
  return [
    { id: crypto.randomUUID(), label: "Go deeper", description: "Explore this topic in more detail." },
    { id: crypto.randomUUID(), label: "Shift perspective", description: "Look at this from a different angle." },
    { id: crypto.randomUUID(), label: "Get practical", description: "Focus on actionable next steps." },
  ];
}
