# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this directory.

## Purpose

Electrobun main process. This is the backend/native layer of the desktop app, running in Bun (not Node.js).

## Key Concepts

- `index.ts` creates the `BrowserWindow` and manages the app lifecycle.
- In dev mode, it checks for a Vite dev server on port 5178 and loads from it for HMR. Otherwise it loads from the bundled `views://mainview/index.html`.
- Uses Electrobun APIs (`BrowserWindow`, `Updater`, `Utils`) -- not Electron.
- The window uses `Borderless` + `FullSizeContentView` style mask.
- `Utils.quit()` is called on window close to terminate the app.

## Conventions

- Do not import browser/DOM APIs here. This runs in Bun, not a browser.
- Use Electrobun's `Updater.localInfo.channel()` to detect dev vs production.
