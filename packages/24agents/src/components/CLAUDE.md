# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

React components for the 24agents app. Feature components live at this level; reusable UI primitives live in `ui/`.

## Current Components (Active)

- `ExploreView.tsx` - **Main app view.** Unified exploration interface replacing PersonaChatWorkspace and BranchingChat. Top bar with History/Back toggle, New button, persona selector, and session title. Two-column layout: SectionPanel (left, flex-1) and branch path cards (right, w-80). Bottom prompt bar with Textarea + Send button (Enter to send, Shift+Enter for newline). Empty state shows centered prompt input with compass icon. History view lists saved exploration sessions. Uses `useExploration` hook.
- `SectionPanel.tsx` - Left panel showing stacked section cards grouped by exploration step. Each step group has a numbered indicator and step prompt label. Cards show section title + markdown content, collapsible for long content (>500 chars). Includes simple inline markdown rendering (bold, italic, code, headers, lists). Shows skeleton loading state.
- `PersonaSelector.tsx` - Dropdown (shadcn DropdownMenu) to pick active persona from localStorage.
- `PersonaManagement.tsx` - Full CRUD for personas. Exports the `Persona` interface. Personas are persisted to localStorage under key `"24agents:personas"`. Serialization and helpers are in `@/lib/persona`.

## Legacy Components (Still in codebase, not imported by active views)

- `BranchingChat.tsx` - Old branching chat UI with tree navigation.
- `PersonaChatWorkspace.tsx` - Old prompt refinement workspace with iteration timeline.
- `PromptBar.tsx`, `IterationTimeline.tsx`, `PersonaPathsPanel.tsx` - Old sub-components of PersonaChatWorkspace.
- `ChatMessage.tsx`, `BranchSelector.tsx`, `BranchBreadcrumb.tsx`, `ChatInput.tsx` - Old sub-components of BranchingChat.

## Conventions

- Import UI primitives from `@/components/ui/*` (shadcn components).
- Use the `@/` path alias which maps to `src/`.
- State is managed with React hooks; no external state library.
- localStorage is the persistence layer. Use the `"24agents:"` key prefix.
- IDs are generated with `crypto.randomUUID()`.
