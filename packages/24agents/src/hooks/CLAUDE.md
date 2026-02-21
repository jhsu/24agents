# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

Custom React hooks for state management. Imported via `@/hooks/*`.

## Contents

- `useExploration.ts` - **Primary hook.** Manages exploration flow with inline refinement state machine. Core exploration: `startExploration(prompt)`, `selectBranch(branchId)`. Refinement flow: `enterRefinementMode(prompt)`, `scoreAndRefine(prompt)`, `previewBranch(branchId)` enter refinement mode; `refinePrompt(personaPath)` calls `/api/chat/rewrite` and adds a `PromptRefinement`; `selectRefinement(id)` picks active refinement; `commitExploration()` uses refined or original prompt to explore; `cancelRefinement()` exits. Tracks: `pending: PendingExploration | null`, `isScoring`, `isRefining`, `personaPaths`, `isLoadingPaths`. Also exposes: `session`, `currentStep`, `allSections` (with stepScore metadata), `isLoading`, `error`, `personaId`, `setPersonaId`, `sessionList`, `loadSession()`, `removeSession()`, `reset()`, `refreshList()`.
- `useChatTree.ts` - Legacy. Manages a single chat tree's state for the old BranchingChat.
- `useChatList.ts` - Legacy. Manages the conversation index for the old BranchingChat.
- `usePromptSession.ts` - Legacy. Manages a prompt refinement session for the old PersonaChatWorkspace.

## Conventions

- Hooks use `useCallback` for stable references passed to child components.
- State is persisted to localStorage via helpers in `@/lib/exploration.ts`.
