# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

Custom React hooks for state management. Imported via `@/hooks/*`.

## Contents

- `useChatTree.ts` - Manages a single chat tree's state. Handles localStorage sync, SSE streaming, branch fetching, and memory persistence. Passes `tree.id` as `sessionId` to `streamChat()` for memory enrichment. After branches are saved, fire-and-forget calls `persistToMemory()` to sync the conversation to long-term memory. Exposes: `tree`, `currentPath`, `isStreaming`, `isFetchingBranches`, `streamingContent`, `sendMessage()`, `selectBranch()`, `navigateTo()`, `resetTree()`, `loadTree()`.
- `useChatList.ts` - Manages the conversation index. Exposes: `entries` (list of `ChatListEntry`), `refresh()`, `remove()`.
- `usePromptSession.ts` - Manages a prompt refinement session. Handles persona path fetching, prompt rewriting via API, iteration tracking, and session history (save/load/delete). Exposes: `session`, `isGenerating`, `personaPaths`, `isLoadingPaths`, `sessionList`, `startSession()`, `loadExistingSession()`, `removeSession()`, `followPersona()`, `continueFromIteration()`, `reset()`, `refreshList()`.

## Conventions

- Hooks use `useCallback` for stable references passed to child components.
- State is persisted to localStorage via helpers in `@/lib/chat-tree.ts` and `@/lib/iteration.ts`.
