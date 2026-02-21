import { catalog } from "../lib/json-render/catalog";
// import type { UIMessage } from 'ai';
import { generateText, streamText } from "ai";
import { pipeJsonRender } from "@json-render/core";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type StreamChunk = {
  type?: string;
  delta?: string;
  data?: {
    type?: string;
    patch?: unknown;
  };
};

type PersonaRecord = {
  id: string;
  name: string;
  definition: string;
  suggestion: string;
  points: number;
  fired: boolean;
};

type SessionRecord = {
  sessionId: string;
  selectedPersonaIds: string[];
  prependedInstructions: string;
  createdAt: number;
};

const model = anthropic("claude-haiku-4-5");
const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

const personas: PersonaRecord[] = [
  {
    id: "software-engineer",
    name: "Software Engineer",
    definition:
      "Focuses on architecture, implementation sequence, reliability, and scaling constraints.",
    suggestion:
      "Specify system boundaries, orchestration flow, failure recovery, and a build-first MVP with concrete interfaces.",
    points: 0,
    fired: false,
  },
  {
    id: "product-manager",
    name: "Product Manager",
    definition: "Focuses on users, scope, measurable outcomes, and launch decisions.",
    suggestion:
      "Define target users, top use cases, MVP scope, launch milestones, and success metrics for the first release.",
    points: 0,
    fired: false,
  },
  {
    id: "designer",
    name: "Designer",
    definition: "Focuses on interaction clarity, trust, and human-in-the-loop controls.",
    suggestion:
      "Design operator workflow, intervention controls, explainability cues, and information hierarchy for confident usage.",
    points: 0,
    fired: false,
  },
];

const sessions = new Map<string, SessionRecord>();

const sessionCreateSchema = z.object({
  title: z.string().optional(),
  initialPrompt: z.string().min(1),
});

const personaSelectSchema = z.object({
  sessionId: z.string().min(1),
  personaIds: z.array(z.string()),
});

const revisePromptRequestSchema = z.object({
  sessionId: z.string().optional(),
  userPrompt: z.string().min(1),
  selectedPersonaIds: z.array(z.string()).optional(),
  prependedInstructions: z.string().optional(),
});

const revisePromptResponseSchema = z.object({
  revisedPrompt: z.string().min(1),
  usedPersonaIds: z.array(z.string()),
  reasoningSummary: z.string().min(1),
});

const generateResponseRequestSchema = z.object({
  sessionId: z.string().optional(),
  revisedPrompt: z.string().min(1),
  selectedPersonaIds: z.array(z.string()).optional(),
});

const generateResponseResponseSchema = z.object({
  responseText: z.string().min(1),
  responseId: z.string().min(1),
  createdAt: z.number(),
});

const evaluationRequestSchema = z.object({
  sessionId: z.string().optional(),
  responseText: z.string().min(1),
  criteria: z.array(z.string().min(1)).min(1),
});

const evaluationResponseSchema = z.object({
  evaluationId: z.string().min(1),
  results: z.array(
    z.object({
      criterion: z.string().min(1),
      score: z.number().min(1).max(10),
      note: z.string().min(1),
    })
  ),
  overallScore: z.number().min(1).max(10),
});

const insightRequestSchema = z.object({
  sessionId: z.string().optional(),
  responseText: z.string().min(1),
  criteria: z.array(z.string()).default([]),
  selectedPersonaIds: z.array(z.string()).default([]),
  evaluationResults: z
    .array(
      z.object({
        criterion: z.string(),
        score: z.number(),
        note: z.string(),
      })
    )
    .optional(),
});

const insightResponseSchema = z.object({
  extractedInstructions: z.string().min(1),
  extractedAt: z.number(),
});

const firePersonaSchema = z.object({
  personaId: z.string().min(1),
});

const incrementPointsSchema = z.object({
  personaIds: z.array(z.string()).min(1),
  reason: z.string().default("prompt_regeneration"),
});

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);

  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return withCors(Response.json(data, init));
}

function jsonError(message: string, status = 400) {
  return jsonResponse({ error: message }, { status });
}

function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

function parseJsonFromText(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1]?.trim() ?? text.trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }

    const firstBracket = candidate.indexOf("[");
    const lastBracket = candidate.lastIndexOf("]");

    if (firstBracket >= 0 && lastBracket > firstBracket) {
      return JSON.parse(candidate.slice(firstBracket, lastBracket + 1));
    }

    throw new Error("Model returned non-JSON output");
  }
}

async function generateStructured<T>({
  schema,
  task,
  input,
}: {
  schema: z.ZodType<T>;
  task: string;
  input: unknown;
}): Promise<T> {
  const { text } = await generateText({
    model,
    system:
      "You are a strict JSON generator. Return only valid JSON matching the requested shape. No markdown.",
    prompt: [
      `Task: ${task}`,
      "Output requirements:",
      "- valid JSON only",
      "- no markdown fences",
      "- include all required fields",
      "Input:",
      JSON.stringify(input),
    ].join("\n"),
  });

  const parsed = parseJsonFromText(text);
  return schema.parse(parsed);
}

function getActivePersonasByIds(ids?: string[]): PersonaRecord[] {
  const active = personas.filter((persona) => !persona.fired);
  if (!ids?.length) return active;
  return active.filter((persona) => ids.includes(persona.id));
}

function fallbackRevisedPrompt(
  userPrompt: string,
  selectedPersonaIds: string[] = [],
  prependedInstructions?: string
) {
  const selected = getActivePersonasByIds(selectedPersonaIds);
  const prefix = prependedInstructions?.trim()
    ? `${prependedInstructions.trim()}\n\nUser prompt:\n${userPrompt}`
    : userPrompt;

  if (!selected.length) {
    return {
      revisedPrompt: prefix,
      usedPersonaIds: [],
      reasoningSummary: "No active personas selected; returned prompt with prepended instructions if provided.",
    };
  }

  return {
    revisedPrompt: [
      prefix,
      "",
      "Revise this idea using selected persona guidance:",
      ...selected.map((persona) => `- ${persona.name}: ${persona.suggestion}`),
      "",
      "Output should include thesis, concrete actions, risks, and validation plan.",
    ].join("\n"),
    usedPersonaIds: selected.map((persona) => persona.id),
    reasoningSummary: "Merged selected persona suggestions into a single revised prompt.",
  };
}

function getOrCreateSession(sessionId?: string): SessionRecord {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }

  const next: SessionRecord = {
    sessionId: sessionId ?? crypto.randomUUID(),
    selectedPersonaIds: [],
    prependedInstructions: "",
    createdAt: Date.now(),
  };
  sessions.set(next.sessionId, next);
  return next;
}

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
      ...CORS_HEADERS,
    },
  });
}

export async function startServer() {
  return Bun.serve({
    port: 4000,
    routes: {
      "/health": () => withCors(new Response("OK")),
      "/api/personas": {
        GET: () => jsonResponse({ personas }),
        OPTIONS: () => corsPreflight(),
      },
      "/api/sessions": {
        OPTIONS: () => corsPreflight(),
        POST: async (req) => {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return jsonError("Invalid JSON body");
          }

          const parsed = sessionCreateSchema.safeParse(body);
          if (!parsed.success) {
            return jsonError(parsed.error.message);
          }

          const session = getOrCreateSession();
          return jsonResponse({
            sessionId: session.sessionId,
            initialPrompt: parsed.data.initialPrompt,
            createdAt: session.createdAt,
          });
        },
      },
      "/api/personas/select": {
        OPTIONS: () => corsPreflight(),
        POST: async (req) => {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return jsonError("Invalid JSON body");
          }

          const parsed = personaSelectSchema.safeParse(body);
          if (!parsed.success) {
            return jsonError(parsed.error.message);
          }

          const session = getOrCreateSession(parsed.data.sessionId);
          session.selectedPersonaIds = parsed.data.personaIds;
          sessions.set(session.sessionId, session);

          return jsonResponse({
            sessionId: session.sessionId,
            selectedPersonaIds: session.selectedPersonaIds,
          });
        },
      },
      "/api/personas/fire": {
        OPTIONS: () => corsPreflight(),
        POST: async (req) => {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return jsonError("Invalid JSON body");
          }

          const parsed = firePersonaSchema.safeParse(body);
          if (!parsed.success) {
            return jsonError(parsed.error.message);
          }

          const persona = personas.find((item) => item.id === parsed.data.personaId);
          if (!persona) return jsonError("Persona not found", 404);

          persona.fired = true;
          return jsonResponse({ persona });
        },
      },
      "/api/personas/rehire": {
        OPTIONS: () => corsPreflight(),
        POST: async (req) => {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return jsonError("Invalid JSON body");
          }

          const parsed = firePersonaSchema.safeParse(body);
          if (!parsed.success) {
            return jsonError(parsed.error.message);
          }

          const persona = personas.find((item) => item.id === parsed.data.personaId);
          if (!persona) return jsonError("Persona not found", 404);

          persona.fired = false;
          return jsonResponse({ persona });
        },
      },
      "/api/personas/points/increment": {
        OPTIONS: () => corsPreflight(),
        POST: async (req) => {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return jsonError("Invalid JSON body");
          }

          const parsed = incrementPointsSchema.safeParse(body);
          if (!parsed.success) {
            return jsonError(parsed.error.message);
          }

          const updated = parsed.data.personaIds
            .map((personaId) => personas.find((item) => item.id === personaId))
            .filter((persona): persona is PersonaRecord => Boolean(persona))
            .map((persona) => {
              persona.points += 1;
              return persona;
            });

          return jsonResponse({ updated, reason: parsed.data.reason });
        },
      },
      "/api/prompts/revise": {
        OPTIONS: () => corsPreflight(),
        POST: async (req) => {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return jsonError("Invalid JSON body");
          }

          const parsed = revisePromptRequestSchema.safeParse(body);
          if (!parsed.success) {
            return jsonError(parsed.error.message);
          }

          const session = getOrCreateSession(parsed.data.sessionId);
          const selectedPersonaIds = parsed.data.selectedPersonaIds ?? session.selectedPersonaIds;
          const prependedInstructions =
            parsed.data.prependedInstructions ?? session.prependedInstructions;

          session.selectedPersonaIds = selectedPersonaIds;
          session.prependedInstructions = prependedInstructions ?? "";
          sessions.set(session.sessionId, session);

          if (!hasAnthropicKey) {
            return jsonResponse(revisePromptResponseSchema.parse(fallbackRevisedPrompt(
              parsed.data.userPrompt,
              selectedPersonaIds,
              prependedInstructions
            )));
          }

          const selectedPersonas = getActivePersonasByIds(selectedPersonaIds);

          try {
            const result = await generateStructured({
              schema: revisePromptResponseSchema,
              task: "Revise the user's prompt using persona suggestions and optional prepended instructions.",
              input: {
                userPrompt: parsed.data.userPrompt,
                prependedInstructions,
                selectedPersonas,
                rules: [
                  "If no selected personas, preserve user prompt and apply prepended instructions only if present.",
                  "If personas selected, merge their suggestions into one coherent revised prompt.",
                ],
              },
            });

            return jsonResponse(result);
          } catch {
            return jsonResponse(
              revisePromptResponseSchema.parse(
                fallbackRevisedPrompt(parsed.data.userPrompt, selectedPersonaIds, prependedInstructions)
              )
            );
          }
        },
      },
      "/api/responses/generate": {
        OPTIONS: () => corsPreflight(),
        POST: async (req) => {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return jsonError("Invalid JSON body");
          }

          const parsed = generateResponseRequestSchema.safeParse(body);
          if (!parsed.success) {
            return jsonError(parsed.error.message);
          }

          const responseId = crypto.randomUUID();
          const createdAt = Date.now();

          if (!hasAnthropicKey) {
            return jsonResponse(
              generateResponseResponseSchema.parse({
                responseId,
                createdAt,
                responseText: [
                  "Generated response:",
                  "- Thesis: Build a phased AI orchestrator that starts simple and becomes adaptive.",
                  "- Actions: define agent contracts, ship templates, add observability and intervention controls.",
                  "- Risks: handoff ambiguity, retry storms, and unclear escalation thresholds.",
                  "- Validation: test with real workflows and track completion rate + intervention frequency.",
                ].join("\n"),
              })
            );
          }

          const selectedPersonas = getActivePersonasByIds(parsed.data.selectedPersonaIds);
          const personaNames = selectedPersonas.map((persona) => persona.name).join(", ");

          const llm = await generateText({
            model,
            system:
              "You produce concise, practical exploratory analysis. Always include thesis, concrete actions, risks, and validation checks.",
            prompt: [
              `Persona context: ${personaNames || "none"}`,
              "Prompt:",
              parsed.data.revisedPrompt,
            ].join("\n\n"),
          });

          return jsonResponse(
            generateResponseResponseSchema.parse({
              responseText: llm.text,
              responseId,
              createdAt,
            })
          );
        },
      },
      "/api/evaluations/run": {
        OPTIONS: () => corsPreflight(),
        POST: async (req) => {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return jsonError("Invalid JSON body");
          }

          const parsed = evaluationRequestSchema.safeParse(body);
          if (!parsed.success) {
            return jsonError(parsed.error.message);
          }

          const evaluationId = crypto.randomUUID();

          if (!hasAnthropicKey) {
            const fallbackResults = parsed.data.criteria.map((criterion, index) => ({
              criterion,
              score: Math.min(10, 7 + ((criterion.length + index) % 3)),
              note: "Quick heuristic eval in fallback mode.",
            }));
            const overallScore =
              fallbackResults.reduce((sum, item) => sum + item.score, 0) /
              Math.max(1, fallbackResults.length);

            return jsonResponse(
              evaluationResponseSchema.parse({
                evaluationId,
                results: fallbackResults,
                overallScore: Number(overallScore.toFixed(1)),
              })
            );
          }

          try {
            const structured = await generateStructured({
              schema: evaluationResponseSchema,
              task: "Evaluate generated response against provided criteria using 1-10 scoring and short notes.",
              input: {
                evaluationId,
                criteria: parsed.data.criteria,
                responseText: parsed.data.responseText,
              },
            });

            return jsonResponse(structured);
          } catch (error) {
            console.error("/api/evaluations/run failed, using fallback", error);
            const fallbackResults = parsed.data.criteria.map((criterion, index) => ({
              criterion,
              score: Math.min(10, 7 + ((criterion.length + index) % 3)),
              note: "Fallback eval after model/schema failure.",
            }));
            const overallScore =
              fallbackResults.reduce((sum, item) => sum + item.score, 0) /
              Math.max(1, fallbackResults.length);

            return jsonResponse(
              evaluationResponseSchema.parse({
                evaluationId,
                results: fallbackResults,
                overallScore: Number(overallScore.toFixed(1)),
              })
            );
          }
        },
      },
      "/api/insights/extract": {
        OPTIONS: () => corsPreflight(),
        POST: async (req) => {
          let body: unknown;
          try {
            body = await req.json();
          } catch {
            return jsonError("Invalid JSON body");
          }

          const parsed = insightRequestSchema.safeParse(body);
          if (!parsed.success) {
            return jsonError(parsed.error.message);
          }

          const extractedAt = Date.now();

          if (!hasAnthropicKey) {
            const instructions = [
              "Prompt instructions from prior evaluation:",
              `- Optimize for: ${parsed.data.criteria.join(", ") || "clarity and feasibility"}.`,
              "- Keep thesis + concrete action plan + risks + validation checks.",
              "- Make tradeoffs explicit before final recommendation.",
            ].join("\n");

            return jsonResponse(
              insightResponseSchema.parse({
                extractedInstructions: instructions,
                extractedAt,
              })
            );
          }

          const selectedPersonas = getActivePersonasByIds(parsed.data.selectedPersonaIds);

          try {
            const structured = await generateStructured({
              schema: insightResponseSchema,
              task:
                "Extract reusable instructions to prepend to future prompts based on response quality and evaluation notes.",
              input: {
                extractedAt,
                selectedPersonas,
                criteria: parsed.data.criteria,
                evaluationResults: parsed.data.evaluationResults,
                responseText: parsed.data.responseText,
                outputRules: [
                  "Keep instructions concise and actionable.",
                  "Include optimization targets and structural output expectations.",
                ],
              },
            });

            return jsonResponse(structured);
          } catch (error) {
            console.error("/api/insights/extract failed, using fallback", error);
            const instructions = [
              "Prompt instructions from prior evaluation:",
              `- Optimize for: ${parsed.data.criteria.join(", ") || "clarity and feasibility"}.`,
              "- Keep thesis + concrete action plan + risks + validation checks.",
              "- Make tradeoffs explicit before final recommendation.",
            ].join("\n");

            return jsonResponse(
              insightResponseSchema.parse({
                extractedInstructions: instructions,
                extractedAt,
              })
            );
          }
        },
      },
      "/test": async () => {
        const result = streamText({
          model,
          system: 'say hello',
          prompt: "hello",
        });

        const stream = createUIMessageStream({
          execute: async ({ writer }) => {
            writer.merge(pipeJsonRender(result.toUIMessageStream()));
          },
        });
        return withCors(createUIMessageStreamResponse({ stream }));
      },
      "/api/persona-ui": {
        OPTIONS: () => corsPreflight(),
        "POST": async (req) => {
          let body: {
            name?: string;
            description?: string;
            messages?: Array<{ role: "user" | "assistant"; content: string }>;
          };

          try {
            body = await req.json();
          } catch {
            return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
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
            model,
            system: systemPrompt,
            messages,
          });

          return createMixedStreamResponse(pipeJsonRender(result.toUIMessageStream()));
        },
      },
      "/api/chat": {
        OPTIONS: () => corsPreflight(),
        POST: async (req) => {
          const payload = await req.json();
          const result = streamText({
            model,
            system: '',
            messages: payload.messagse,
          });
          const stream = createUIMessageStream({
            execute: async ({ writer }) => {
              writer.merge(pipeJsonRender(result.toUIMessageStream()));
            },
          });
          return withCors(createUIMessageStreamResponse({ stream }));
        },
      },
    },
    development: {
      hmr: true,
      console: true,
    },
  });
}
