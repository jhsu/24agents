# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

React components for the 24agents app. Feature components live at this level; reusable UI primitives live in `ui/`.

## Current Components (Active)

- `ExploreView.tsx` - **Main app view.** Unified exploration interface with inline refinement. Three rendering states: normal (SectionPanel left + branch cards right), refining (RefinementPanel), history. Branch cards show CFNR score previews and dual "Refine"/"Explore" buttons. Prompt bar has "Refine" (sparkle icon) and "Send" buttons. Uses `useExploration` hook. Layout is a flex column constrained to `h-screen`; the content area uses `overflow-hidden` to stay within its flex allocation so the prompt bar remains pinned at the bottom.
- `SectionPanel.tsx` - Left panel showing stacked section cards grouped by exploration step. Each step group has a numbered indicator, step prompt label, and optional CFNR score badges (via `ScoreRow`). Cards show section title + markdown content, collapsible for long content (>500 chars). Includes simple inline markdown rendering.
- `ScoreBadge.tsx` - Shared CFNR score display. Exports `ScoreBadge` (single metric badge with color coding) and `ScoreRow` (all four C/F/N/R badges in a row). Uses `scoreColor()` from `@/lib/iteration`.
- `RefinementPanel.tsx` - Inline prompt refinement UI shown when `pending` state is non-null. Two-column layout: left column shows original prompt + refinement cards (persona avatar, reasoning, refined prompt, CFNR scores) with "Explore Now"/"Cancel" buttons; right column shows persona suggestion cards from `fetchPersonaPaths()`. Active refinement highlighted with green border.
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
