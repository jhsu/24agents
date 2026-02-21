# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

Frontend entry point and renderer process. This is what runs in the browser window.

## Files

- `index.html` - HTML shell. Sets `class="dark"` on `<html>` for dark-mode-only theming. Mounts React into `<div id="root">`.
- `main.tsx` - React entry point. Renders `<App />` in `StrictMode` into the root div.
- `App.tsx` - Root React component. Renders a 3-tab layout using shadcn Tabs: "Chat" (PersonaChatWorkspace), "Persona UI" (BranchingChat), "Manage Personas" (PersonaManagement). Active tabs have green styling. Inactive tabs are hidden via `data-[state=inactive]:hidden`.

## Conventions

- Vite handles bundling. The HTML file references `main.tsx` directly via `<script type="module">`.
- All theme colors are defined as CSS custom properties in `src/global.css` using oklch color space. To change the color scheme, edit the `:root` variables there.
- The app is dark-mode only. Do not add light-mode theme variables.
