# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

React components for the 24agents app. Feature components live at this level; reusable UI primitives live in `ui/`.

## Current Components

- `PersonaManagement.tsx` - Full CRUD for personas. Exports the `PersonaManagement` component and the `Persona` interface. Personas are persisted to localStorage under key `"24agents:personas"` and can be serialized to a text prompt format via `serializePersona()` for clipboard copy.

## Conventions

- Import UI primitives from `@/components/ui/*` (shadcn components).
- Use the `@/` path alias which maps to `src/`.
- State is managed with React hooks; no external state library.
- localStorage is the persistence layer. Use the `"24agents:"` key prefix.
- IDs are generated with `crypto.randomUUID()`.
