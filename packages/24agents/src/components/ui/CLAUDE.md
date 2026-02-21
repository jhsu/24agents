# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

shadcn/ui components built on Radix UI primitives. These are the low-level, reusable UI building blocks.

## Adding Components

```bash
bunx shadcn@latest add <component>
```

The shadcn config is in `components.json` at the package root (style: `"radix-lyra"`).

## Conventions

- Components use `React.forwardRef` and accept a `className` prop merged via `cn()` from `@/lib/utils`.
- Variants are defined with `class-variance-authority` (CVA). See `button.tsx` for the pattern.
- Components use `data-slot` attributes for CSS targeting.
- Do not modify these files heavily -- they are meant to stay close to shadcn defaults. Customize via `className` props or wrapper components in the parent `components/` directory.
