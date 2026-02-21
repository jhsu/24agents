import { query } from "@anthropic-ai/claude-agent-sdk";

export async function startServer() {
  return Bun.serve({
    port: 4000,
    routes: {
      "/health": () => new Response("OK"),
      "/test": () => {
        const prompt = "Hello, how are you?";
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              const send = (data: unknown) => {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                );
              };

              try {
                for await (const message of query({ prompt, options: {
                  pathToClaudeCodeExecutable: "/Users/joseph/.local/bin/claude"
                } })) {
                  send(message);
                }
              } catch (error) {
                send({ type: "error", error: String(error) });
              } finally {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              }
            }
          })
          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
      },
      "/api/chat": {
        POST: async (req) => {
          let body: {
            prompt?: string;
            history?: { role: string; content: string }[];
            systemPrompt?: string;
            allowedTools?: string[];
          };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }

          const { prompt, history, systemPrompt, allowedTools } = body;
          if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
            return Response.json({ error: "prompt is required" }, { status: 400 });
          }

          // Build full prompt with conversation history and system prompt
          let fullPrompt = "";
          if (systemPrompt) {
            fullPrompt += `<system>\n${systemPrompt}\n</system>\n\n`;
          }
          if (history && history.length > 0) {
            for (const msg of history) {
              fullPrompt += `<${msg.role}>\n${msg.content}\n</${msg.role}>\n\n`;
            }
          }
          fullPrompt += prompt;

          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              const send = (data: unknown) => {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
                );
              };

              try {
                const options: Record<string, unknown> = {};
                if (allowedTools !== undefined) {
                  options.allowedTools = allowedTools;
                }
                for await (const message of query({ prompt: fullPrompt, options })) {
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
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }

          const { conversationContext, currentResponse, personaPrompt } = body;
          if (!currentResponse) {
            return Response.json({ error: "currentResponse is required" }, { status: 400 });
          }

          let prompt = "";
          if (personaPrompt) {
            prompt += `<system>\n${personaPrompt}\n</system>\n\n`;
          }

          if (conversationContext && conversationContext.length > 0) {
            prompt += "Here is the conversation so far:\n\n";
            for (const msg of conversationContext) {
              prompt += `<${msg.role}>\n${msg.content}\n</${msg.role}>\n\n`;
            }
          }

          prompt += `The latest assistant response was:\n${currentResponse}\n\n`;
          prompt += `Based on this conversation, suggest exactly 3 interesting branching paths the user could explore next. Each branch should be a distinct direction for the conversation.

Return ONLY a JSON array with exactly 3 objects, each having "id" (unique string), "label" (short 3-6 word title), and "description" (one sentence explaining the direction). No other text, just the JSON array.`;

          try {
            let fullResult = "";
            for await (const message of query({ prompt, options: { allowedTools: [] } })) {
              if (message && typeof message === "object") {
                const msg = message as Record<string, unknown>;
                if (msg.type === "result" && typeof msg.result === "string") {
                  fullResult += msg.result;
                } else if (msg.type === "assistant") {
                  const assistantMsg = msg.message as { content?: Array<{ type: string; text?: string }> } | undefined;
                  if (assistantMsg?.content) {
                    for (const block of assistantMsg.content) {
                      if (block.type === "text" && block.text) {
                        fullResult += block.text;
                      }
                    }
                  }
                }
              }
            }

            // Extract JSON array from the response
            const jsonMatch = fullResult.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const branches = JSON.parse(jsonMatch[0]);
              if (Array.isArray(branches) && branches.length > 0) {
                // Ensure each branch has an id
                const validated = branches.slice(0, 3).map((b: Record<string, string>, i: number) => ({
                  id: b.id || crypto.randomUUID(),
                  label: b.label || `Path ${i + 1}`,
                  description: b.description || "",
                }));
                return Response.json({ branches: validated });
              }
            }

            // Fallback if parsing fails
            return Response.json({
              branches: [
                { id: crypto.randomUUID(), label: "Go deeper", description: "Explore this topic in more detail." },
                { id: crypto.randomUUID(), label: "Shift perspective", description: "Look at this from a different angle." },
                { id: crypto.randomUUID(), label: "Get practical", description: "Focus on actionable next steps." },
              ],
            });
          } catch (error) {
            return Response.json({
              branches: [
                { id: crypto.randomUUID(), label: "Go deeper", description: "Explore this topic in more detail." },
                { id: crypto.randomUUID(), label: "Shift perspective", description: "Look at this from a different angle." },
                { id: crypto.randomUUID(), label: "Get practical", description: "Focus on actionable next steps." },
              ],
            });
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
