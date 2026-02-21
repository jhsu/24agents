import Anthropic from "@anthropic-ai/sdk";
import {
  getMemoryPrompt,
  putWorkingMemory,
  createLongTermMemory,
  searchLongTermMemory,
} from "./memory-client";

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
            sessionId?: string;
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
          }

          const { prompt, history, systemPrompt, sessionId } = body;
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

          // Enrich system prompt with memory context (fire-and-forget safe)
          let enrichedSystemPrompt = systemPrompt || undefined;
          try {
            const memoryMessages = await getMemoryPrompt(prompt, sessionId);
            if (memoryMessages && memoryMessages.length > 0) {
              const memoryContext = memoryMessages
                .filter((m) => m.role === "system")
                .map((m) => m.content)
                .join("\n\n");
              if (memoryContext) {
                enrichedSystemPrompt = enrichedSystemPrompt
                  ? `${memoryContext}\n\n${enrichedSystemPrompt}`
                  : memoryContext;
              }
            }
          } catch {
            // Memory enrichment is optional — continue without it
          }

          const encoder = new TextEncoder();
          const allMessages = [...messages]; // capture for post-stream sync
          const stream = new ReadableStream({
            async start(controller) {
              try {
                const apiStream = client.messages.stream({
                  model: MODEL,
                  max_tokens: 4096,
                  system: enrichedSystemPrompt,
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

                // Fire-and-forget: sync conversation to working memory
                if (sessionId) {
                  putWorkingMemory(sessionId, { messages: allMessages }).catch(() => {});
                }
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
      "/api/chat/rewrite": {
        POST: async (req) => {
          let body: {
            prompt?: string;
            personaPrompt?: string;
            iterationContext?: string;
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
          }

          const { prompt, personaPrompt, iterationContext } = body;
          if (!prompt || !personaPrompt) {
            return Response.json({ error: "prompt and personaPrompt are required" }, { status: 400, headers: CORS_HEADERS });
          }

          const contextBlock = iterationContext
            ? `\n\nPrevious iteration context:\n${iterationContext}`
            : "";

          const messages: { role: "user" | "assistant"; content: string }[] = [
            {
              role: "user",
              content: `You are rewriting a prompt from a specific persona's perspective. Here is the original prompt:\n\n"${prompt}"${contextBlock}\n\nRewrite this prompt to be clearer, more specific, and more effective from your persona's perspective. Then evaluate the rewritten prompt.\n\nReturn ONLY a JSON object with these fields:\n- "refinedPrompt": the rewritten prompt (string)\n- "responseText": a brief explanation of what you changed and why (string, 2-3 sentences)\n- "score": an object with C (Clarity 1-10), F (Feasibility 1-10), N (Novelty 1-10), R (Relevance 1-10)\n\nNo other text, just the JSON object.`,
            },
          ];

          try {
            const response = await client.messages.create({
              model: MODEL,
              max_tokens: 2048,
              system: personaPrompt,
              messages,
            });

            let fullResult = "";
            for (const block of response.content) {
              if (block.type === "text") {
                fullResult += block.text;
              }
            }

            const jsonMatch = fullResult.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return Response.json({
                refinedPrompt: parsed.refinedPrompt || prompt,
                responseText: parsed.responseText || "Prompt refined.",
                score: {
                  C: Math.min(10, Math.max(1, parsed.score?.C ?? 5)),
                  F: Math.min(10, Math.max(1, parsed.score?.F ?? 5)),
                  N: Math.min(10, Math.max(1, parsed.score?.N ?? 5)),
                  R: Math.min(10, Math.max(1, parsed.score?.R ?? 5)),
                },
              }, { headers: CORS_HEADERS });
            }

            return Response.json({
              refinedPrompt: prompt,
              responseText: "Could not parse response. Using original prompt.",
              score: { C: 5, F: 5, N: 5, R: 5 },
            }, { headers: CORS_HEADERS });
          } catch (error) {
            console.error("Rewrite error:", error);
            return Response.json({
              refinedPrompt: prompt,
              responseText: `Error: ${error}`,
              score: { C: 5, F: 5, N: 5, R: 5 },
            }, { headers: CORS_HEADERS });
          }
        },
      },
      "/api/chat/persona-paths": {
        POST: async (req) => {
          let body: {
            prompt?: string;
            personas?: { id: string; name: string; description: string }[];
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
          }

          const { prompt, personas } = body;
          if (!prompt || !personas || personas.length === 0) {
            return Response.json({ error: "prompt and personas are required" }, { status: 400, headers: CORS_HEADERS });
          }

          const personaList = personas
            .map((p, i) => `${i + 1}. "${p.name}" - ${p.description}`)
            .join("\n");

          const messages: { role: "user" | "assistant"; content: string }[] = [
            {
              role: "user",
              content: `Given the following prompt:\n\n"${prompt}"\n\nAnd these personas:\n${personaList}\n\nFor each persona, write a short 1-2 sentence description of how that persona would approach rewriting or refining this prompt. What unique perspective would they bring?\n\nReturn ONLY a JSON array where each element has:\n- "personaId": the persona's id\n- "personaName": the persona's name\n- "description": how this persona would approach the prompt (1-2 sentences)\n\nNo other text, just the JSON array.`,
            },
          ];

          try {
            const response = await client.messages.create({
              model: MODEL,
              max_tokens: 2048,
              system: "You help users understand how different expert perspectives would approach refining a prompt.",
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
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed)) {
                const paths = parsed.map((p: Record<string, string>) => {
                  const persona = personas.find((pp) => pp.id === p.personaId) || personas[0];
                  const name = p.personaName || persona.name;
                  return {
                    personaId: p.personaId || persona.id,
                    personaName: name,
                    initials: name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2),
                    description: p.description || "Would refine this prompt from their unique perspective.",
                  };
                });
                return Response.json({ paths }, { headers: CORS_HEADERS });
              }
            }

            // Fallback: generate generic paths
            const fallbackPaths = personas.map((p) => ({
              personaId: p.id,
              personaName: p.name,
              initials: p.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2),
              description: `Would refine this prompt from a ${p.name.toLowerCase()} perspective.`,
            }));
            return Response.json({ paths: fallbackPaths }, { headers: CORS_HEADERS });
          } catch (error) {
            console.error("Persona paths error:", error);
            const fallbackPaths = personas.map((p) => ({
              personaId: p.id,
              personaName: p.name,
              initials: p.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2),
              description: `Would refine this prompt from a ${p.name.toLowerCase()} perspective.`,
            }));
            return Response.json({ paths: fallbackPaths }, { headers: CORS_HEADERS });
          }
        },
      },
      "/api/memory/persist": {
        POST: async (req) => {
          let body: {
            sessionId?: string;
            messages?: { role: string; content: string }[];
            title?: string;
            personaId?: string | null;
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
          }

          const { sessionId, messages, personaId } = body;
          if (!messages || messages.length === 0) {
            return Response.json({ error: "messages are required" }, { status: 400, headers: CORS_HEADERS });
          }

          try {
            // Convert conversation messages to long-term memory records
            const memories = messages
              .filter((m) => m.content.trim().length > 0)
              .map((m) => ({
                text: m.content,
                session_id: sessionId,
                namespace: "24agents",
                user_id: personaId || undefined,
              }));

            await createLongTermMemory(memories);
            return Response.json({ ok: true }, { headers: CORS_HEADERS });
          } catch (error) {
            console.error("Memory persist error:", error);
            return Response.json({ error: "Failed to persist memory" }, { status: 500, headers: CORS_HEADERS });
          }
        },
      },
      "/api/memory/search": {
        POST: async (req) => {
          let body: { query?: string; limit?: number };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
          }

          const { query, limit } = body;
          if (!query) {
            return Response.json({ error: "query is required" }, { status: 400, headers: CORS_HEADERS });
          }

          try {
            const results = await searchLongTermMemory(query, {
              namespace: "24agents",
              limit: limit || 10,
            });
            return Response.json(results, { headers: CORS_HEADERS });
          } catch (error) {
            console.error("Memory search error:", error);
            return Response.json({ memories: [], total: 0 }, { headers: CORS_HEADERS });
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
