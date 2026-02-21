# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

Shared utility functions, data models, and client libraries. Imported via `@/lib/*`.

## Contents

- `utils.ts` - Exports `cn()`, a classname merge helper combining `clsx` and `tailwind-merge`. Used by all UI components for conditional/merged Tailwind classes.
- `persona.ts` - Shared persona utilities: `serializePersona()` converts a Persona to AI prompt text, `getInitials()` extracts 2-letter initials, `loadPersonas()`/`savePersonas()` handle localStorage persistence. Used by both PersonaManagement and the chat system.
- `chat-tree.ts` - Chat tree data model. Defines `ChatNode`, `ChatTree`, `BranchSuggestion`, `ChatListEntry` types. Pure helper functions: `createTree()`, `createNode()`, `addNode()`, `getPathToNode()`, `setBranches()`, `selectBranch()`, `getConversationHistory()`. Persistence via localStorage at `"24agents:chat:{id}"` per conversation and `"24agents:chat-list"` for the index.
- `exploration.ts` - **Primary data model.** Defines `ExploreSection` (id, title, content), `ExploreBranch` (id, label, description), `ExploreStep` (prompt + sections + branches + parent link), `ExploreSession` (steps list, persona, title, timestamps), `ExploreSessionListEntry`. Pure helpers: `createExploreSession()`, `createStep()`, `addStepToSession()`. Persistence via localStorage at `"24agents:explore:{id}"` per session and `"24agents:explore-list"` for the index.
- `sse-client.ts` - API client for the backend. `explorePrompt()` calls `POST /api/chat/explore` and returns parsed `{ sections, branches }`. `streamChat()` is an async generator that consumes SSE from `POST /api/chat`. `fetchBranches()` calls `POST /api/chat/branches`. `rewritePrompt()` calls `POST /api/chat/rewrite`. `fetchPersonaPaths()` calls `POST /api/chat/persona-paths`. `persistToMemory()` and `searchMemory()` handle memory server calls.
- `iteration.ts` - Legacy prompt session data model. Defines `IterationScore`, `Iteration`, `PersonaPath`, `PromptSession`, `PromptInput`, `SessionListEntry` types. Not used by the active ExploreView but still in codebase.
