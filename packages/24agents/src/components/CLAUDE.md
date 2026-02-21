# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

React components for the 24agents app. Feature components live at this level; reusable UI primitives live in `ui/`.

## Current Components

- `BranchingChat.tsx` - Main app view. Full-height layout with top bar (breadcrumb, history, persona selector), scrollable chat area, and bottom input. Orchestrates the chat tree, streaming, and branch selection.
- `ChatMessage.tsx` - Single message bubble with Avatar. User messages right-aligned with bg-primary, assistant messages left-aligned with bg-muted. Supports streaming state.
- `BranchSelector.tsx` - 3 clickable Card components shown after assistant messages with branch suggestions. Shows skeleton loading state while branches are being fetched.
- `BranchBreadcrumb.tsx` - Horizontal breadcrumb of branch points in the conversation tree. Clicking navigates back to that node.
- `ChatInput.tsx` - Textarea + Send button. Enter to send, Shift+Enter for newline.
- `PersonaSelector.tsx` - Dropdown (shadcn DropdownMenu) to pick active persona from localStorage.
- `PersonaManagement.tsx` - Full CRUD for personas. Exports the `Persona` interface. Personas are persisted to localStorage under key `"24agents:personas"`. Serialization and helpers are in `@/lib/persona`.
- `PersonaChatWorkspace.tsx` - Main Chat tab. Renders PromptBar at top, then a two-column layout: IterationTimeline (left, flex-1) and PersonaPathsPanel (right, w-80). Uses `usePromptSession` hook.
- `PromptBar.tsx` - Horizontal bar with Input, green Generate Button, and Reset Button. Calls `onGenerate(prompt)` on submit.
- `IterationTimeline.tsx` - Left column showing the original prompt, then a vertical stack of IterationCard components. Each card shows persona name, timestamp, response text, refined prompt, color-coded CFNR scores, and a "Continue This Path" button.
- `PersonaPathsPanel.tsx` - Right column showing persona path cards with avatar initials, AI-generated descriptions of how each persona would approach the prompt, and "Follow Persona" buttons. Shows skeleton loaders while fetching.

## Conventions

- Import UI primitives from `@/components/ui/*` (shadcn components).
- Use the `@/` path alias which maps to `src/`.
- State is managed with React hooks; no external state library.
- localStorage is the persistence layer. Use the `"24agents:"` key prefix.
- IDs are generated with `crypto.randomUUID()`.
