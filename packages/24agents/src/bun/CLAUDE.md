# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

Electrobun main process and API server. This is the backend/native layer of the desktop app, running in Bun (not Node.js).

## Key Concepts

- `index.ts` creates the `BrowserWindow`, starts the API server, and manages the app lifecycle.
- In dev mode, it checks for a Vite dev server on port 5178 and loads from it for HMR. Otherwise it loads from the bundled `views://mainview/index.html`.
- Uses Electrobun APIs (`BrowserWindow`, `Updater`, `Utils`) -- not Electron.
- The window uses `Borderless` + `FullSizeContentView` style mask.
- `Utils.quit()` is called on window close to terminate the app.
- `server.ts` runs a Bun HTTP server on port 4000 with the following endpoints:
  - `GET /health` - Health check.
  - `POST /api/chat` - Chat endpoint. Accepts `{ prompt, history?, systemPrompt? }`. Builds messages array from history and streams the response via SSE using `@anthropic-ai/sdk` (Anthropic API directly). SSE events are `{ type: "text", text: "..." }`.
  - `POST /api/chat/branches` - Branch suggestions endpoint. Accepts `{ conversationContext, currentResponse, personaPrompt? }`. Asks Claude for 3 branching paths and returns them as JSON. Falls back to generic suggestions on failure.
  - `POST /api/chat/rewrite` - Prompt rewrite endpoint. Accepts `{ prompt, personaPrompt, iterationContext? }`. Asks Claude to rewrite the prompt from the persona's perspective and return `{ refinedPrompt, responseText, score: { C, F, N, R } }`. Falls back to original prompt on parse failure.
  - `POST /api/chat/persona-paths` - Persona paths endpoint. Accepts `{ prompt, personas: {id, name, description}[] }`. Returns `{ paths: PersonaPath[] }` describing how each persona would approach the prompt. Falls back to generic descriptions on failure.
- All API responses include CORS headers (`Access-Control-Allow-Origin: *`) since the Electrobun webview loads from `views://` protocol.
- The server loads `.env.local` by walking up directories from `import.meta.dir` to find the project root, since Electrobun runs the bundled server from inside the `.app` bundle.

## Conventions

- Do not import browser/DOM APIs here. This runs in Bun, not a browser.
- Use Electrobun's `Updater.localInfo.channel()` to detect dev vs production.
- API key is read from `ANTHROPIC_API_KEY` in `.env.local`. Uses `@anthropic-ai/sdk` (not `claude-agent-sdk`).
