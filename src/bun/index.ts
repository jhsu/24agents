import {
  BrowserWindow,
  BrowserView,
  type RPCSchema,
  Updater,
  Utils,
} from "electrobun/bun";
import path from "node:path";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import Redis from "ioredis";
import type {
  AddPersonaParams,
  FetchApiParams,
  OpenTimelineStreamParams,
  PersonaData,
  ProcessingStatus,
  TimelineWebviewMessages,
  TweetPost,
  UpdatePersonaParams,
} from "../shared/timeline";

const DEV_SERVER_PORT = 5178;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

const DEFAULT_DEBOUNCE_MS = 3500;
const DEFAULT_MAX_WAIT_MS = 12000;
const DEFAULT_MAX_BATCH_SIZE = 20;
const DEFAULT_REDIS_CHANNEL = "claude-code:log";
const MAX_TWEET_HISTORY = 200;

type Persona = {
  name: string;
  handle: string;
  avatarUrl: string;
  description: string;
};

type ClaudeHookLog = {
  timestamp?: string;
  hook_name?: string;
  payload?: Record<string, unknown>;
};

type TimelineRPCSchema = {
  bun: RPCSchema<{
    requests: {
      fetchApi: { params: FetchApiParams; response: unknown };
      openTimelineStream: {
        params: OpenTimelineStreamParams | undefined;
        response: {
          started: boolean;
          debounceMs: number;
          maxWaitMs: number;
          channel: string;
        };
      };
      closeTimelineStream: {
        params: undefined;
        response: { stopped: boolean };
      };
      getTimelineTweets: { params: undefined; response: TweetPost[] };
      getPersonas: { params: undefined; response: PersonaData[] };
      addPersona: { params: AddPersonaParams; response: PersonaData };
      updatePersona: { params: UpdatePersonaParams; response: PersonaData };
      deletePersona: { params: { handle: string }; response: { deleted: boolean } };
    };
    messages: {};
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: TimelineWebviewMessages;
  }>;
};

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  return "views://mainview/index.html";
}

const DEFAULT_PERSONAS: Persona[] = [
  {
    name: "Maya Threadwell",
    handle: "mayathreadwell",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=mayathreadwell",
    description:
      "Ex-startup operator turned AI product commentator. Writes crisp thread-style takes, zooming from details to strategy in one jump. Posts when she sees momentum, pivots, or signs a prototype is becoming a real product.",
  },
  {
    name: "Ravi Null",
    handle: "ravinull",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=ravinull",
    description:
      "Principal engineer with dry humor and zero patience for hand-wavy claims. Writes short, technical posts with precise language. Posts when he spots reliability wins, shaky assumptions, or expensive mistakes avoided.",
  },
  {
    name: "Bree Growth",
    handle: "breegrowth",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=breegrowth",
    description:
      "Growth-minded indie builder who talks in experiments, loops, and user behavior. Writes energetic, practical observations with founder vibes. Posts when she sees fast iteration, clear feedback loops, or retention signals emerging.",
  },
  {
    name: "Nico Sarcasm",
    handle: "nicosarcasm",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=nicosarcasm",
    description:
      "Meme-native tech observer with a sharp tongue and good instincts. Writes witty one-liners and playful jabs without being toxic. Posts when the team does something ironically relatable, chaotic, or unexpectedly elegant.",
  },
  {
    name: "Elena Receipts",
    handle: "elenareceipts",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=elenareceipts",
    description:
      "Data-first analyst who cares about evidence over vibes. Writes measured posts that connect outcomes to concrete signals. Posts when there is enough observable behavior to support a claim, especially around quality and consistency.",
  },
  {
    name: "Coach Juno",
    handle: "coachjuno",
    avatarUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=coachjuno",
    description:
      "Supportive creator-economy voice who frames progress as craft and discipline. Writes encouraging, human posts with light motivational energy. Posts when she sees recovery after errors, team composure, or sustained execution under pressure.",
  },
];

const PERSONAS_FILE = path.join(process.cwd(), "personas.json");

async function loadPersonas(): Promise<Persona[]> {
  try {
    const file = Bun.file(PERSONAS_FILE);
    if (await file.exists()) {
      const data = (await file.json()) as Persona[];
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (err) {
    console.error("Failed to load personas.json, using defaults:", err);
  }
  return DEFAULT_PERSONAS;
}

async function savePersonas(list: Persona[]): Promise<void> {
  try {
    await Bun.write(PERSONAS_FILE, JSON.stringify(list, null, 2));
  } catch (err) {
    console.error("Failed to save personas.json:", err);
  }
}

let personas: Persona[] = await loadPersonas();

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

let redisSub: Redis | null = null;
let redisChannel = DEFAULT_REDIS_CHANNEL;
let debounceMs = DEFAULT_DEBOUNCE_MS;
let maxWaitMs = DEFAULT_MAX_WAIT_MS;
let maxBatchSize = DEFAULT_MAX_BATCH_SIZE;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
let pendingLogs: ClaudeHookLog[] = [];
let isFlushing = false;
let tweetCounter = 0;
let tweetHistory: TweetPost[] = [];

function clearFlushTimers() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (maxWaitTimer) {
    clearTimeout(maxWaitTimer);
    maxWaitTimer = null;
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function extractTextField(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseLogMessage(raw: string): ClaudeHookLog | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const record = toRecord(parsed);
    if (Object.keys(record).length === 0) {
      return null;
    }

    return {
      timestamp:
        typeof record.timestamp === "string" ? record.timestamp : undefined,
      hook_name:
        typeof record.hook_name === "string" ? record.hook_name : undefined,
      payload: toRecord(record.payload),
    };
  } catch {
    return null;
  }
}

type BatchContext = {
  totalEvents: number;
  hooksSummary: string;
  toolsSummary: string;
  filesSummary: string;
  topTools: string[];
  topFiles: string[];
  errorsCount: number;
  promptSnippet: string | null;
  lastMessageSnippet: string | null;
};

function buildBatchContext(logs: ClaudeHookLog[]): BatchContext {
  const hookCounts = new Map<string, number>();
  const toolCounts = new Map<string, number>();
  const filePaths: string[] = [];
  let errorsCount = 0;
  let promptSnippet: string | null = null;
  let lastMessageSnippet: string | null = null;

  for (const entry of logs) {
    const hookName = entry.hook_name ?? "Unknown";
    hookCounts.set(hookName, (hookCounts.get(hookName) ?? 0) + 1);

    const payload = entry.payload ?? {};
    const toolName = extractTextField(payload.tool_name);
    if (toolName) {
      toolCounts.set(toolName, (toolCounts.get(toolName) ?? 0) + 1);
    }

    const error = extractTextField(payload.error);
    if (error) {
      errorsCount += 1;
    }

    const prompt = extractTextField(payload.prompt);
    if (prompt) {
      promptSnippet = prompt.slice(0, 120);
    }

    const assistantMessage = extractTextField(payload.last_assistant_message);
    if (assistantMessage) {
      lastMessageSnippet = assistantMessage.slice(0, 120);
    }

    const toolInput = toRecord(payload.tool_input);
    const pathCandidate =
      extractTextField(toolInput.file_path) ??
      extractTextField(toolInput.path) ??
      extractTextField(toolInput.filePath);

    if (pathCandidate && filePaths.length < 6) {
      const shortPath = path.basename(pathCandidate);
      if (!filePaths.includes(shortPath)) {
        filePaths.push(shortPath);
      }
    }
  }

  const hookSummary = [...hookCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => `${name}(${count})`)
    .join(", ");

  const toolSummary = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name}(${count})`)
    .join(", ");

  const topTools = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  return {
    totalEvents: logs.length,
    hooksSummary: hookSummary || "none",
    toolsSummary: toolSummary || "none",
    filesSummary: filePaths.length > 0 ? filePaths.join(", ") : "none",
    topTools,
    topFiles: filePaths,
    errorsCount,
    promptSnippet,
    lastMessageSnippet,
  };
}

function buildTweet(persona: Persona, text: string): TweetPost {
  tweetCounter += 1;
  return {
    id: `${Date.now()}-${tweetCounter}`,
    name: persona.name,
    handle: persona.handle,
    avatarUrl: persona.avatarUrl,
    text: text.slice(0, 280),
    timestamp: Date.now(),
  };
}

function humanJoin(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function buildPersonaFallbackText(persona: Persona, batch: BatchContext): string {
  const keyTool = batch.topTools[0] ?? "tool calls";
  const secondaryTool = batch.topTools[1] ?? "changes";
  const keyFile = batch.topFiles[0] ?? "the timeline";
  const hasErrors = batch.errorsCount > 0;

  if (persona.handle === "lexvisionary") {
    if (hasErrors) {
      return `The product signal today is resilience. We hit friction, recovered fast, and kept momentum. That's what real platform maturity looks like.`;
    }
    return `You can feel the product hardening in real time. ${keyTool} around ${keyFile} is exactly how a rough prototype turns into something people trust.`;
  }

  if (persona.handle === "danakern") {
    if (hasErrors) {
      return `Saw ${batch.errorsCount} failure path${batch.errorsCount > 1 ? "s" : ""}. Recovery looked controlled, not chaotic. Keep that discipline and this stream will stay reliable.`;
    }
    return `Mostly ${humanJoin([keyTool, secondaryTool])}. Tight loop, low drama. The changes around ${keyFile} look incremental in the right way.`;
  }

  if (hasErrors) {
    return `Uh oh, there was a little code bonk, but then everyone fixed it and kept going. It felt like dropping blocks and building the tower again!`;
  }

  return `The code helpers are passing notes super fast and making ${keyFile} nicer and nicer. It feels like watching a tiny robot team clean their room!`;
}

function buildFallbackTweets(batch: BatchContext): TweetPost[] {
  const persona = personas[tweetCounter % personas.length];
  const text = buildPersonaFallbackText(persona, batch);
  return [buildTweet(persona, text)];
}

async function generateTweetsFromLogs(logs: ClaudeHookLog[]): Promise<TweetPost[]> {
  const batch = buildBatchContext(logs);

  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallbackTweets(batch);
  }

  const personaDescriptions = personas
    .map((p) => `- handle="${p.handle}" name="${p.name}": ${p.description}`)
    .join("\n");

  try {
    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      temperature: 0.9,
      prompt: [
        "You run a live social feed watching an AI coding agent work in real time.",
        "Based on the activity batch below, decide which 1-3 of these personas would tweet about it and write their tweets.",
        "Each persona has a very distinct voice and perspective. Stay fully in character and make them sound naturally human.",
        "Not every persona needs to respond. Pick the ones whose personality fits the activity best.",
        "Avoid robotic summaries and avoid raw metric-dump phrasing.",
        "Ground each tweet in specific activity signals, but phrase them like normal social posts.",
        "",
        "Personas:",
        personaDescriptions,
        "",
        "Output strict JSON array only: [{\"handle\":\"...\",\"text\":\"...\"}, ...]",
        "No hashtags. Each text must be <= 240 chars. Return 1-3 tweets total.",
        "In the text field, use **word** to bold specific tool names (Read, Glob, Grep, Edit, Write, Bash, Task), file names, hook names, and key technical concepts. Use bold sparingly — only the most meaningful terms per tweet.",
        "",
        `total_events=${batch.totalEvents}`,
        `hooks=${batch.hooksSummary}`,
        `tools=${batch.toolsSummary}`,
        `files=${batch.filesSummary}`,
        `errors=${batch.errorsCount}`,
        `prompt_hint=${batch.promptSnippet ?? "none"}`,
        `assistant_hint=${batch.lastMessageSnippet ?? "none"}`,
      ].join("\n"),
    });

    const raw = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(raw) as unknown;
    const arr = Array.isArray(parsed) ? parsed : [parsed];

    const tweets: TweetPost[] = [];
    for (const item of arr) {
      if (typeof item !== "object" || item === null) continue;
      const { handle, text } = item as { handle?: string; text?: string };
      if (typeof text !== "string" || text.trim().length === 0) continue;
      const persona =
        personas.find((p) => p.handle === handle) ?? personas[tweetCounter % personas.length];
      tweets.push(buildTweet(persona, text.trim()));
    }

    return tweets.length > 0 ? tweets : buildFallbackTweets(batch);
  } catch (error) {
    console.error("tweet generation failed", error);
    return buildFallbackTweets(batch);
  }
}

type AppRPC = ReturnType<typeof BrowserView.defineRPC<TimelineRPCSchema>>;

function sendStatus(rpc: AppRPC, status: ProcessingStatus) {
  rpc.send.processingStatus(status);
}

async function flushBufferedLogs(rpc: AppRPC) {
  if (pendingLogs.length === 0 || isFlushing) {
    return;
  }

  clearFlushTimers();
  isFlushing = true;

  try {
    const logs = pendingLogs;
    pendingLogs = [];

    sendStatus(rpc, { state: "generating", personaCount: 0 });
    const tweets = await generateTweetsFromLogs(logs);
    const personaCount = new Set(tweets.map((tweet) => tweet.handle)).size;
    sendStatus(rpc, { state: "generating", personaCount });

    for (const tweet of tweets) {
      tweetHistory = [tweet, ...tweetHistory].slice(0, MAX_TWEET_HISTORY);
      rpc.send.tweetPushed(tweet);
    }
    sendStatus(rpc, { state: "idle" });
  } catch (err) {
    sendStatus(rpc, { state: "error", error: String(err) });
  } finally {
    isFlushing = false;
    if (pendingLogs.length > 0) {
      scheduleFlush(rpc);
    }
  }
}

function scheduleFlush(rpc: AppRPC) {
  if (flushTimer) clearTimeout(flushTimer);

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushBufferedLogs(rpc);
  }, debounceMs);

  if (!maxWaitTimer) {
    maxWaitTimer = setTimeout(() => {
      maxWaitTimer = null;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      void flushBufferedLogs(rpc);
    }, maxWaitMs);
  }
}

function queueLog(rawMessage: string, rpc: AppRPC) {
  const parsed = parseLogMessage(rawMessage);
  if (!parsed) {
    return;
  }

  pendingLogs.push(parsed);
  sendStatus(rpc, { state: "buffering", pendingCount: pendingLogs.length });

  if (pendingLogs.length >= maxBatchSize) {
    clearFlushTimers();
    void flushBufferedLogs(rpc);
    return;
  }

  scheduleFlush(rpc);
}

async function startRedisSubscription(rpc: AppRPC) {
  if (redisSub) {
    return;
  }

  const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  const subscriber = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

  subscriber.on("message", (channel, message) => {
    if (channel === redisChannel) {
      queueLog(message, rpc);
    }
  });

  subscriber.on("error", (error) => {
    console.error("redis subscriber error", error);
    sendStatus(rpc, { state: "error", error: "Redis connection error" });
  });

  await subscriber.connect();
  await subscriber.subscribe(redisChannel);
  redisSub = subscriber;
}

async function stopRedisSubscription(rpc: AppRPC): Promise<boolean> {
  if (!redisSub) {
    return false;
  }

  clearFlushTimers();

  await flushBufferedLogs(rpc);

  try {
    await redisSub.unsubscribe(redisChannel);
  } finally {
    redisSub.disconnect();
    redisSub = null;
  }

  return true;
}

// Create the main application window
const url = await getMainViewUrl();

const rpc = BrowserView.defineRPC<TimelineRPCSchema>({
  handlers: {
    requests: {
      async fetchApi({ url, options }: FetchApiParams) {
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return await response.json();
      },
      openTimelineStream(params?: OpenTimelineStreamParams) {
        debounceMs = Math.max(1000, params?.debounceMs ?? DEFAULT_DEBOUNCE_MS);
        maxWaitMs = Math.max(debounceMs, params?.maxWaitMs ?? DEFAULT_MAX_WAIT_MS);
        maxBatchSize = Math.max(1, params?.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE);
        redisChannel = params?.redisChannel?.trim() || DEFAULT_REDIS_CHANNEL;

        void startRedisSubscription(rpc);
        return { started: true, debounceMs, maxWaitMs, channel: redisChannel };
      },
      async closeTimelineStream() {
        const stopped = await stopRedisSubscription(rpc);
        return { stopped };
      },
      getTimelineTweets() {
        return tweetHistory;
      },
      getPersonas() {
        return personas.map(({ handle, name, avatarUrl, description }) => ({
          handle,
          name,
          avatarUrl,
          description,
        }));
      },
      async addPersona(params: AddPersonaParams) {
        if (personas.some((p) => p.handle === params.handle)) {
          throw new Error(`Handle already exists: ${params.handle}`);
        }
        const avatarUrl = `https://api.dicebear.com/9.x/shapes/svg?seed=${params.handle}`;
        const newPersona: Persona = { ...params, avatarUrl };
        personas = [...personas, newPersona];
        await savePersonas(personas);
        return newPersona;
      },
      async updatePersona(params: UpdatePersonaParams) {
        const idx = personas.findIndex((p) => p.handle === params.handle);
        if (idx === -1) throw new Error(`Persona not found: ${params.handle}`);
        const updated: Persona = { ...personas[idx], ...params };
        personas = personas.map((p, i) => (i === idx ? updated : p));
        await savePersonas(personas);
        return updated;
      },
      async deletePersona({ handle }: { handle: string }) {
        const prevLength = personas.length;
        personas = personas.filter((p) => p.handle !== handle);
        const deleted = personas.length < prevLength;
        if (deleted) await savePersonas(personas);
        return { deleted };
      },
    },
    messages: {},
  },
});

const mainWindow = new BrowserWindow({
  title: "React + Tailwind + Vite",
  url,
  rpc,
  styleMask: {
    Resizable: true,
    Borderless: true,
    Closable: true,
    FullSizeContentView: true,
  },
});

mainWindow.setAlwaysOnTop(true);

// Quit the app when the main window is closed
mainWindow.on("close", () => {
  void stopRedisSubscription(rpc).finally(() => {
    Utils.quit();
  });
});

console.log("React Tailwind Vite app started!");
