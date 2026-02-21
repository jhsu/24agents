import { catalog } from "../lib/json-render/catalog";
// import type { UIMessage } from 'ai';
import { streamText } from "ai";
import { pipeJsonRender } from "@json-render/core";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

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
          let body: { name?: string; description?: string };
          try {
            body = await req.json();
          } catch {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
          }
          const userPrompt = `Generate the UI to control the persona ${body.name} with the description ${body.description}`;

          const systemPrompt = catalog.prompt();
          const result = streamText({
            model: anthropic("claude-haiku-4-5"),
            system: systemPrompt,
            prompt: userPrompt,
          });

          const stream = createUIMessageStream({
            execute: async ({ writer }) => {
              writer.merge(pipeJsonRender(result.toUIMessageStream()));
            },
          });
          return createUIMessageStreamResponse({ stream });
          
        }
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