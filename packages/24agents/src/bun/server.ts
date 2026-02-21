import { catalog } from "../lib/json-render/catalog";
// import type { UIMessage } from 'ai';
import { streamText } from "ai";
import { pipeJsonRender } from "@json-render/core";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

type StreamChunk = {
  type?: string;
  delta?: string;
  data?: {
    type?: string;
    patch?: unknown;
  };
};

function createMixedStreamResponse(stream: ReadableStream<unknown>) {
  const encoder = new TextEncoder();

  const textStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = value as StreamChunk;

          if (chunk.type === "text-delta" && typeof chunk.delta === "string") {
            controller.enqueue(encoder.encode(chunk.delta));
            continue;
          }

          if (
            chunk.type === "data-spec" &&
            chunk.data?.type === "patch" &&
            chunk.data.patch
          ) {
            controller.enqueue(encoder.encode(`${JSON.stringify(chunk.data.patch)}\n`));
          }
        }
      } finally {
        reader.releaseLock();
        controller.close();
      }
    },
  });

  return new Response(textStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function startServer() {
  return Bun.serve({
    port: 4000,
    routes: {
      "/health": () => new Response("OK"),
      "/test": async () => {
        const result = streamText({
          model: anthropic("claude-haiku-4-5"),
          system: '',
          prompt: "hello",
        });

        const stream = createUIMessageStream({
          execute: async ({ writer }) => {
            writer.merge(pipeJsonRender(result.toUIMessageStream()));
          },
        });
        return createUIMessageStreamResponse({ stream });
      },
      "/api/persona-ui": {
        "POST": async (req) => {
          let body: {
            name?: string;
            description?: string;
            messages?: Array<{ role: "user" | "assistant"; content: string }>;
          };

          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }

          const messages = Array.isArray(body.messages)
            ? body.messages
            : [
                {
                  role: "user" as const,
                  content: `Generate the UI to control the persona ${body.name} with the description ${body.description}`,
                },
              ];

          const systemPrompt = catalog.prompt();
          const result = streamText({
            model: anthropic("claude-haiku-4-5"),
            system: systemPrompt,
            messages,
          });

          return createMixedStreamResponse(pipeJsonRender(result.toUIMessageStream()));
        },
      },
      "/api/chat": {
        POST: async (req) => {
          const payload = await req.json();
          const result = streamText({
            model: anthropic("claude-haiku-4-5"),
            system: '',
            messages: payload.messagse,
          });
          const stream = createUIMessageStream({
            execute: async ({ writer }) => {
              writer.merge(pipeJsonRender(result.toUIMessageStream()));
            },
          });
          return createUIMessageStreamResponse({ stream });
        },
      },
    },
    development: {
      hmr: true,
      console: true,
    },
  });
}
