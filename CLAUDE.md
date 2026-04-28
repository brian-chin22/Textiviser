# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start        # production — node server/index.js
npm run dev      # development — nodemon with auto-restart
```

The server serves the client statically from `client/` and listens on port 3000 (or `$PORT`).

Requires `server/.env` with `GOOGLE_API_KEY` set to a Google AI Studio key.

## Architecture

**Single-endpoint backend** (`server/index.js`): One POST route `/api/revise` accepts a `{ prompt }` string, calls Gemini (`gemini-2.5-flash-lite`) via `@google/generative-ai`, and streams the response back as chunked `text/plain`. No sessions, no database, no auth.

**Vanilla JS frontend** (`client/main.js` + `client/index.html`): No framework or bundler. Three pages (Text Reviser, Cover Letter, Email) rendered via hash-based routing — toggling `.active` on `.page` divs. All state lives in the `pillGroups` object (keyed by `data-group` attribute) and plain DOM inputs.

**Data flow per revision:**
1. User clicks Revise → page-specific `buildPrompt()` assembles a structured prompt string from pill selections and text inputs
2. `runRevision()` POSTs to `/api/revise` and reads the streaming response via `ReadableStream`
3. Chunks are fed into a `requestAnimationFrame` render queue (`CHARS_PER_FRAME = 8`) that types text into the output textarea at a fixed rate

**Key helpers:**
- `getControlValue(groupName)` — reads custom text input first, falls back to the active pill value. The `groupName` must match the `data-group` attribute on the `.preset-pills` element and the `id` of the paired `<input class="custom-input">` (pattern: `${groupName}-custom`).
- The render queue (`renderQueue`, `renderTarget`, `rafId`) is a single global — only one streaming revision can be active at a time. `resetQueue()` cancels any in-flight animation before starting a new one.

**Adding a new page** requires: a new `<div id="page-X" class="page">` in `index.html`, a new hash entry in the `pages` router map in `main.js`, a `buildXPrompt()` function, and wiring up the revise/copy buttons through `runRevision()` and `handleCopySuccess()`.
