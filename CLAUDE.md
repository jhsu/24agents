# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

24agents is a desktop app for generating AI personas that help explore ideas. Users create personas with names and descriptions, which serialize to text prompts for AI-driven commentary and path suggestion.

## Commands

```bash
# Development (with HMR)
bun run dev:hmr

# Development (without HMR)
bun run dev

# Build
bun run build

# Production build
bun run build:prod

# Run tests
bun test
```

## Architecture

**Desktop framework:** Electrobun (Bun-native, not Electron). The main process runs in `src/bun/index.ts` using `BrowserWindow`.

**Build pipeline:** Vite builds the React frontend into `dist/`, then Electrobun packages it into a desktop app. In dev mode with HMR, Electrobun loads from Vite's dev server on port 5178.

**Frontend:** React 18 + TypeScript, rendered in `src/mainview/`. Entry point is `src/mainview/main.tsx`, root component is `src/mainview/App.tsx`.

**UI components:** shadcn/ui built on Radix UI primitives, located in `src/components/ui/`. Uses CVA (class-variance-authority) for variant styling and a `cn()` utility from `src/components/lib/utils.ts`.

**Styling:** Tailwind CSS 4.2 with CSS variables (oklch color space). Dark mode only (`class="dark"` on root HTML element).

**State:** React hooks + localStorage (key prefix: `"24agents:"`). No external state management library.

**Path aliases:** `@/*` maps to `src/*` (configured in tsconfig.json and vite.config.ts).

## Key Files

- `src/bun/index.ts` - Electrobun main process, creates browser window
- `src/mainview/App.tsx` - React root component
- `src/components/PersonaManagement.tsx` - Main feature: persona CRUD with clipboard serialization
- `electrobun.config.ts` - Desktop app build config
- `vite.config.ts` - Frontend build config
- `components.json` - shadcn UI config (style: "radix-lyra")

## Notes

- The root CLAUDE.md says "Don't use vite" but this package uses Vite + Electrobun. Follow the actual project setup.
- `@json-render/core` and `@json-render/react` are dependencies for JSON-driven UI rendering.
- When adding shadcn components, use `bunx shadcn@latest add <component>`.
