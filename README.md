# 24agents

A desktop app that watches your Claude Code AI agent work in real time and turns it into a live social media timeline — narrated by a cast of AI personas with distinct voices and opinions.

## What it does

Claude Code emits hook events as it works (tool calls, file reads, edits, errors). **24agents** subscribes to those events via Redis, batches them, and asks Claude to generate tweet-style commentary from the perspective of multiple personas — each with their own personality and take on what the agent is doing.

The result is a Twitter/X-style feed that narrates your AI agent's activity as it happens.

## Personas

Six built-in commentators, each with a distinct voice:

| Persona | Handle | Vibe |
|---|---|---|
| Maya Threadwell | `@mayathreadwell` | Ex-startup operator, crisp strategic takes |
| Ravi Null | `@ravinull` | Principal engineer, dry humor, precise |
| Bree Growth | `@breegrowth` | Indie builder, experiments and energy |
| Nico Sarcasm | `@nicosarcasm` | Meme-native, witty one-liners |
| Elena Receipts | `@elenareceipts` | Data-first analyst, evidence over vibes |
| Coach Juno | `@coachjuno` | Supportive creator-economy voice |

Not every persona tweets on every batch — only the ones whose personality fits the activity.

You can add, edit, and delete personas from the **Personas** tab in the app.

## Setup

```bash
# Install dependencies
bun install

# Set up environment
cp .env.example .env
# Add ANTHROPIC_API_KEY and REDIS_URL to .env
```

### Prerequisites

- [Bun](https://bun.sh) runtime
- Redis running locally (`redis://127.0.0.1:6379` by default)
- `ANTHROPIC_API_KEY` for tweet generation (optional — falls back to deterministic text without it)

### Configure Claude Code hooks

This repo's hook script (`.claude/hooks/log_hook.py`) appends each event to `claude.log` and also publishes the same JSON line to Redis. The app listens on the `claude-code:log` channel by default.

## Running

```bash
# Development (with hot reload)
bun run dev:hmr

# Development (without HMR)
bun run dev

# Production build
bun run build
```

## Replaying logs

Test the feed without a live agent session by replaying an existing Claude log file:

```bash
bun run replay:claude-log -- --file ./claude.log --channel claude-code:log --delay-ms 50
```

Useful flags:

| Flag | Description |
|---|---|
| `--start-line <n>` | Start from a specific line |
| `--end-line <n>` | Stop at a specific line |
| `--limit <n>` | Cap how many events are published |
| `--dry-run` | Parse and count without publishing |

```bash
# Full help
bun run src/bun/replayClaudeLog.ts --help
```

## How it works

1. Claude Code emits JSON hook events to a Redis pub/sub channel
2. The app batches events with a configurable debounce window (default: 3.5s, max wait: 12s)
3. Each batch is summarized and sent to `claude-haiku-4-5` with the persona descriptions
4. Claude picks 1–3 personas that fit the activity and writes their tweets
5. Tweets are pushed to the UI via Electrobun RPC and appear in the feed

## Configuration

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection URL |
| `REDIS_CHANNEL` | `claude-code:log` | Redis pub/sub channel used by hook publisher |
| `ANTHROPIC_API_KEY` | — | Enables AI tweet generation |

Stream options (set from the UI or via RPC):

| Option | Default | Description |
|---|---|---|
| `redisChannel` | `claude-code:log` | Redis channel to subscribe to |
| `debounceMs` | `3500` | Wait after last event before flushing |
| `maxWaitMs` | `12000` | Hard cap before forced flush |
| `maxBatchSize` | `20` | Flush immediately at this batch size |

## Project structure

```
src/
├── bun/
│   ├── index.ts              # Main process: Redis subscription, tweet generation, RPC
│   └── replayClaudeLog.ts    # CLI tool for replaying log files
├── mainview/
│   ├── App.tsx               # Root React component (feed + personas tabs)
│   ├── index.html            # HTML entry point
│   └── index.css             # Tailwind CSS
├── components/
│   ├── TweetCard.tsx         # Individual tweet UI
│   └── PersonasPage.tsx      # Persona management UI
└── shared/
    └── timeline.ts           # Shared types (RPC schema, tweet shape, etc.)
```

## Tech stack

- [Electrobun](https://electrobun.dev) — desktop app runtime (Bun + native macOS webview)
- [Bun](https://bun.sh) — runtime, bundler, package manager
- React + Tailwind CSS — UI
- Redis — event transport layer
- Vercel AI SDK + Claude Haiku — tweet generation
