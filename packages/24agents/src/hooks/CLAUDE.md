# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

Custom React hooks for state management. Imported via `@/hooks/*`.

## Contents

- `useExploration.ts` - **Primary hook.** Manages the unified exploration flow. Calls `explorePrompt()` to get structured sections + branches, tracks exploration steps, handles persona integration via `serializePersona()`, manages session history (save/load/delete). Exposes: `session`, `currentStep`, `allSections` (accumulated from all steps with stepId/stepPrompt metadata), `isLoading`, `error`, `personaId`, `setPersonaId`, `startExploration(prompt)`, `selectBranch(branchId)`, `sessionList`, `loadSession()`, `removeSession()`, `reset()`, `refreshList()`.
- `useChatTree.ts` - Legacy. Manages a single chat tree's state for the old BranchingChat.
- `useChatList.ts` - Legacy. Manages the conversation index for the old BranchingChat.
- `usePromptSession.ts` - Legacy. Manages a prompt refinement session for the old PersonaChatWorkspace.

## Conventions

- Hooks use `useCallback` for stable references passed to child components.
- State is persisted to localStorage via helpers in `@/lib/exploration.ts`.
