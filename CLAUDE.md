# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Chrome development (hot reload)
pnpm dev

# Firefox development
pnpm devf

# Chrome production build
pnpm build

# Firefox production build
pnpm buildf

# Build + package for Chrome (creates .zip for store submission)
pnpm packageb

# Build + package for Firefox
pnpm packagebf
```

Load the dev build from `build/chrome-mv3-dev` (Chrome) or `build/firefox-mv3-dev` (Firefox) in the browser's extension developer page.

There is no test suite configured.

## Architecture

This is a **Plasmo** browser extension (MV3, Chrome + Firefox) — a "bring your own LLM" translator.

### Entry Points (Plasmo conventions)

| Path | Role |
|------|------|
| `background/index.ts` | Service Worker initialization |
| `background/ports/translate.ts` | Port handler: receives translation requests, streams back SSE chunks |
| `background/messages/ping.ts` | Message handler for connectivity testing |
| `contents/overlay.tsx` | Content Script UI (CSUI) — injected into every page via Shadow DOM for text-selection translation |
| `popup/index.tsx` | Popup window |
| `options/index.tsx` | Full-page options UI with sidebar navigation |

### Communication Pattern

All translation requests flow through a **long-lived port** named `"translate"` (Plasmo messaging):

```
Content Script / Popup  →  Port("translate")  →  background/ports/translate.ts
```

The background handler streams `TranslateResponseBody` messages back (`status: "streaming" | "completed" | "error"`). Frontends listen via `usePort("translate")` from `@plasmohq/messaging/hook`.

**Critical**: All LLM API calls must originate from the background service worker — never from content scripts (CORS issues and key exposure).

### Storage

All settings are stored as a single object under the key `"app-settings"` in local storage via `@plasmohq/storage`.

- **In React components**: `useAppSettings()` from `lib/storage.ts` — returns `[settings, setSettings]`
- **In background/non-React**: `getAppSettings()` from `lib/storage.ts` — returns a Promise

Settings shape is defined in `lib/types.ts` as `AppSettings`. `DEFAULT_SETTINGS` in the same file defines all defaults. When adding new fields to `AppSettings`, always add a corresponding default to `DEFAULT_SETTINGS` — the storage layer does a shallow merge on load.

### Key Library Files

- **`lib/types.ts`** — All TypeScript interfaces (`AppSettings`, `ApiConfig`, `PromptConfig`, `TranslateRequestBody`, `TranslateResponseBody`), `DEFAULT_SETTINGS`, `DEFAULT_SYSTEM_PROMPT`, `LANGUAGES` list, and `buildSystemPrompt()` helper.
- **`lib/storage.ts`** — `useAppSettings()` hook and `getAppSettings()` async helper.
- **`lib/llm.ts`** — `streamLLM()`: generic OpenAI-compatible streaming fetch with SSE parsing. Used for API connection testing; the main translation handler in `background/ports/translate.ts` has its own inline streaming logic with failover.
- **`lib/lang-detect.ts`** — `detectLanguage()` using `franc-min`; maps ISO 639-3 codes to ISO 639-1 app codes.

### Translation Logic (Background Port Handler)

`background/ports/translate.ts` orchestrates:
1. Load settings, filter enabled APIs per `autoSwitchApi` flag
2. Check cache in `history[]` (when `cacheEnabled`)
3. Detect source language via `franc-min`, apply auto-swap logic (`targetLang1` ↔ `targetLang2`)
4. Loop through APIs with failover: fetch OpenAI-compatible `/chat/completions` with `stream: true`, parse SSE, stream chunks back via port
5. On success, save to `history[]` in storage (up to `historyLimit`)

The system prompt template uses `{{to}}` / `{target_lang}` as the target language placeholder and `{text}` for user text in the user prompt.

### Import Alias

`~` maps to the project root. Use `~lib/types`, `~lib/storage`, `~style.css`, etc. for imports.

### Styling

Tailwind CSS with CSS custom properties for theming (`bg-background`, `text-foreground`, `bg-card`, `text-primary`, `text-muted-foreground`, etc.). Dark mode uses **class-based** strategy (`darkMode: "class"` in `tailwind.config.js`). The `.dark` CSS variables are defined in `style.css` under `.dark { ... }` (not `@media`).

- **Popup & Options**: A `useEffect` in each page root applies/removes `dark` class on `document.documentElement` based on `settings.theme`. System preference is detected via `matchMedia` and re-evaluated on OS change.
- **Overlay (CSUI)**: Computes `isDark` inline and adds `dark` class to its root container div inside the shadow DOM. Uses hardcoded Tailwind color classes (`dark:bg-zinc-950` etc.) rather than CSS variable classes.

The CSUI (`contents/overlay.tsx`) injects `style.css` via Plasmo's `getStyle()` export and uses inline Shadow DOM to avoid host-page CSS conflicts.

### Options Page Structure

`options/index.tsx` is a tab-based layout. Each tab is a separate component in `options/sections/`:
- `GeneralSettings` — theme, target languages
- `ApiSettings` — CRUD + drag-and-drop ordering of `ApiConfig[]` (via `@dnd-kit`)
- `PromptSettings` — manage `PromptConfig[]`; the default prompt (`isDefault: true`) cannot be deleted
- `SelectionSettings` — content script UI behavior (mode, icon size, offsets, panel size)
- `PopupSettings` — auto-translate toggle, debounce time
- `AdvancedSettings` — history, cache, import/export
