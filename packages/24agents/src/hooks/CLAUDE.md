# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

Custom React hooks for state management. Imported via `@/hooks/*`.

## Contents

- `useChatTree.ts` - Manages a single chat tree's state. Handles localStorage sync, SSE streaming, branch fetching. Exposes: `tree`, `currentPath`, `isStreaming`, `isFetchingBranches`, `streamingContent`, `sendMessage()`, `selectBranch()`, `navigateTo()`, `resetTree()`, `loadTree()`.
- `useChatList.ts` - Manages the conversation index. Exposes: `entries` (list of `ChatListEntry`), `refresh()`, `remove()`.

## Conventions

- Hooks use `useCallback` for stable references passed to child components.
- State is persisted to localStorage via helpers in `@/lib/chat-tree.ts`.
