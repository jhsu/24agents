# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

Shared utility functions, data models, and client libraries. Imported via `@/lib/*`.

## Contents

- `utils.ts` - Exports `cn()`, a classname merge helper combining `clsx` and `tailwind-merge`. Used by all UI components for conditional/merged Tailwind classes.
- `persona.ts` - Shared persona utilities: `serializePersona()` converts a Persona to AI prompt text, `getInitials()` extracts 2-letter initials, `loadPersonas()`/`savePersonas()` handle localStorage persistence. Used by both PersonaManagement and the chat system.
- `chat-tree.ts` - Chat tree data model. Defines `ChatNode`, `ChatTree`, `BranchSuggestion`, `ChatListEntry` types. Pure helper functions: `createTree()`, `createNode()`, `addNode()`, `getPathToNode()`, `setBranches()`, `selectBranch()`, `getConversationHistory()`. Persistence via localStorage at `"24agents:chat:{id}"` per conversation and `"24agents:chat-list"` for the index.
- `sse-client.ts` - API client for the backend. `streamChat()` is an async generator that consumes SSE from `POST /api/chat` (accepts optional `sessionId` for memory enrichment), yielding text from `{ type: "text", text: "..." }` events. `fetchBranches()` calls `POST /api/chat/branches` and returns parsed `BranchSuggestion[]`. `rewritePrompt()` calls `POST /api/chat/rewrite` for persona-driven prompt refinement with CFNR scoring. `fetchPersonaPaths()` calls `POST /api/chat/persona-paths` to get descriptions of how each persona would approach a prompt. `persistToMemory()` calls `POST /api/memory/persist` to save conversations to long-term memory (fire-and-forget, fails silently). `searchMemory()` calls `POST /api/memory/search` for semantic search across past conversations.
- `iteration.ts` - Prompt session data model. Defines `IterationScore` (C/F/N/R 1-10), `Iteration`, `PersonaPath`, `PromptSession`, `SessionListEntry` types. Pure helpers: `createSession()`, `addIteration()`. Persistence via localStorage at `"24agents:session:{id}"` per session and `"24agents:session-list"` for the session index. Session list helpers: `loadSessionList()`, `deleteSession()`. Formatting helpers: `formatScore()`, `scoreColor()` (green 7+, yellow 5-6, red <5).
