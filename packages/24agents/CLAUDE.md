# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

24agents is a desktop app for exploring ideas with AI through structured, branching exploration. Users enter a prompt, the AI responds with structured sections (e.g., "Ingredients", "Preparation", "Tips") plus 2-3 branching paths to explore further. Selecting a branch recursively generates new sections and branches, building a tree of explored ideas. Users create personas that guide the AI's perspective. A 2-tab interface (Explore, Manage Personas) ties it together.

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
- `src/bun/server.ts` - Bun HTTP server (port 4000) with explore, chat, branches, rewrite, persona-paths, score-prompt, and memory API endpoints, uses `@anthropic-ai/sdk` directly
- `src/bun/memory-client.ts` - Thin fetch wrapper for redis/agent-memory-server REST API (working memory, long-term memory, memory prompt enrichment). All calls fail silently if the memory server is unavailable.
- `src/mainview/App.tsx` - React root component, renders 2-tab layout (Explore, Manage Personas)
- `src/components/ExploreView.tsx` - Unified exploration view with inline refinement. Three rendering states: normal (sections + branches), refining (RefinementPanel), history. Branch cards show CFNR score previews and "Refine"/"Explore" buttons. Prompt bar has "Refine" button alongside Send.
- `src/components/SectionPanel.tsx` - Left panel showing stacked section cards grouped by exploration step, with step indicators, CFNR score badges in step headers, collapsible content, and simple markdown rendering.
- `src/components/ScoreBadge.tsx` - Shared CFNR score display components (`ScoreBadge`, `ScoreRow`). Uses `scoreColor()` from iteration.ts.
- `src/components/RefinementPanel.tsx` - Inline prompt refinement UI. Two-column layout: refinement cards with persona attribution + scores (left), persona suggestion cards (right). "Explore Now" commits the active refinement or original prompt.
- `src/components/PersonaSelector.tsx` - Dropdown (shadcn DropdownMenu) to pick active persona from localStorage.
- `src/components/PersonaManagement.tsx` - Persona CRUD with clipboard serialization (in Manage Personas tab)
- `src/lib/exploration.ts` - Exploration data model. Defines `ExploreSection`, `ExploreBranch` (with `previewScore`), `ExploreStep` (with `score`, `refinements`, `activeRefinementId`), `PromptRefinement`, `PendingExploration`, `ExploreSession`, `ExploreSessionListEntry` types. Persistence via localStorage.
- `src/lib/sse-client.ts` - API client for explore endpoint (returns scores), chat streaming, branches, prompt rewriting, persona paths, prompt scoring, and memory persistence/search
- `src/lib/persona.ts` - Shared persona serialization and localStorage helpers
- `src/hooks/useExploration.ts` - Exploration state management hook with inline refinement. Core flow: startExploration → selectBranch → recurse. Refinement flow: enterRefinementMode/scoreAndRefine → refinePrompt (per persona) → commitExploration. Manages session history, persona integration, refinement state machine, persona path loading.
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
