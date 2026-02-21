# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

24agents is a desktop app for exploring ideas with AI through branching conversations and iterative prompt refinement. Users create personas that guide the AI's perspective. The app has two main modes: (1) a **Persona Chat Workspace** where users refine prompts through multiple personas with an iteration timeline and CFNR scoring, and (2) a **Branching Chat** where the AI suggests 2-3 branching paths to explore after each response, building a tree of explored ideas. A tabbed interface (Chat, Persona UI, Manage Personas) ties them together.

## Commands

```bash
# Development (with HMR)
bun run dev:hmr

# Development (without HMR)
bun run dev

# Build
bun run build

# Production build
bun run build:prod

# Run tests
bun test
```

## Architecture

**Desktop framework:** Electrobun (Bun-native, not Electron). The main process runs in `src/bun/index.ts` using `BrowserWindow`.

**Build pipeline:** Vite builds the React frontend into `dist/`, then Electrobun packages it into a desktop app. In dev mode with HMR, Electrobun loads from Vite's dev server on port 5178.

**Frontend:** React 18 + TypeScript, rendered in `src/mainview/`. Entry point is `src/mainview/main.tsx`, root component is `src/mainview/App.tsx`.

**UI components:** shadcn/ui built on Radix UI primitives, located in `src/components/ui/`. Uses CVA (class-variance-authority) for variant styling and a `cn()` utility from `src/components/lib/utils.ts`.

**Styling:** Tailwind CSS 4.2 with CSS variables (oklch color space). Dark mode only (`class="dark"` on root HTML element).

**State:** React hooks + localStorage (key prefix: `"24agents:"`). No external state management library.

**Path aliases:** `@/*` maps to `src/*` (configured in tsconfig.json and vite.config.ts).

## Key Files

- `src/bun/index.ts` - Electrobun main process, creates browser window
- `src/bun/server.ts` - Bun HTTP server (port 4000) with chat, branches, rewrite, persona-paths, and memory API endpoints, uses `@anthropic-ai/sdk` directly
- `src/bun/memory-client.ts` - Thin fetch wrapper for redis/agent-memory-server REST API (working memory, long-term memory, memory prompt enrichment). All calls fail silently if the memory server is unavailable.
- `src/mainview/App.tsx` - React root component, renders 3-tab layout (Chat, Persona UI, Manage Personas)
- `src/components/PersonaChatWorkspace.tsx` - Prompt refinement workspace: prompt bar + two-column layout (iteration timeline left, persona paths right)
- `src/components/PromptBar.tsx` - Prompt input bar with Generate and Reset buttons
- `src/components/IterationTimeline.tsx` - Left column showing iteration cards with persona name, refined prompt, response, and CFNR scores
- `src/components/PersonaPathsPanel.tsx` - Right column showing persona path cards with Follow Persona buttons
- `src/components/BranchingChat.tsx` - Branching chat UI with tree navigation (in Persona UI tab)
- `src/components/PersonaManagement.tsx` - Persona CRUD with clipboard serialization (in Manage Personas tab)
- `src/lib/chat-tree.ts` - Chat tree data model, types, and localStorage persistence
- `src/lib/iteration.ts` - Iteration data model (Iteration, IterationScore, PersonaPath, PromptSession) and localStorage persistence
- `src/lib/sse-client.ts` - API client for chat streaming, branches, prompt rewriting, persona paths, and memory persistence/search
- `src/lib/persona.ts` - Shared persona serialization and localStorage helpers
- `src/hooks/useChatTree.ts` - Chat tree state management hook
- `src/hooks/usePromptSession.ts` - Prompt session state management hook (generate → follow persona → iterate)
- `src/hooks/useChatList.ts` - Conversation list management hook
- `electrobun.config.ts` - Desktop app build config
- `vite.config.ts` - Frontend build config
- `docker-compose.yml` - Redis Stack + agent-memory-server for cross-conversation memory (optional, app works without it)
- `components.json` - shadcn UI config (style: "radix-lyra")

## Notes

- The root CLAUDE.md says "Don't use vite" but this package uses Vite + Electrobun. Follow the actual project setup.
- `@json-render/core` and `@json-render/react` are dependencies for JSON-driven UI rendering.
- When adding shadcn components, use `bunx shadcn@latest add <component>`.
- The API server uses `@anthropic-ai/sdk` (not `claude-agent-sdk`) to call the Anthropic API directly.
- `.env.local` must contain `ANTHROPIC_API_KEY`. Optionally add `OPENAI_API_KEY` for embedding-based semantic search and `MEMORY_SERVER_URL` (defaults to `http://localhost:8000`). The server loads it by walking up from `import.meta.dir` since Electrobun runs from inside the `.app` bundle.
- All API endpoints include CORS headers for the `views://` webview origin.
- **Memory server (optional):** `docker compose --env-file .env.local up -d` starts Redis + agent-memory-server. Chat is enriched with cross-conversation context when the server is running. The app works identically without it.
