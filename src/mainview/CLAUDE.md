# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

Frontend entry point and renderer process. This is what runs in the browser window.

## Files

- `index.html` - HTML shell. Sets `class="dark"` on `<html>` for dark-mode-only theming. Mounts React into `<div id="root">`.
- `main.tsx` - React entry point. Renders `<App />` in `StrictMode` into the root div.
- `App.tsx` - Root React component. Currently renders `PersonaManagement` in a centered, max-width layout.
- `index.css` - Global styles. Imports Tailwind CSS, `tw-animate-css`, and `shadcn/tailwind.css`. Defines the full dark-mode color theme using oklch CSS variables and the `@theme inline` directive.

## Conventions

- Vite handles bundling. The HTML file references `main.tsx` directly via `<script type="module">`.
- All theme colors are defined as CSS custom properties in `index.css` using oklch color space. To change the color scheme, edit the `:root` variables there.
- The app is dark-mode only. Do not add light-mode theme variables.
