# Browser Tab Age Extension

Browser extension that tracks **how old your open tabs are** — marks stale tabs with a color-coded L-bracket favicon overlay and displays a sortable age table.

Built with **WXT** · **Vue 3** · **Pinia** · **Quasar** · **TypeScript** · **Playwright** · **Vitest**

---

## What it does

| Feature | Description |
|---|---|
| **Tab age tracking** | Classifies every open tab as _fresh / young / middle / old_ based on `lastAccessed` timestamp |
| **L-bracket overlay** | Injects a colored L-bracket onto the favicon of old tabs (rendered via `OffscreenCanvas` in the service worker) |
| **Options page** | Full sortable table of all tabs with age, favicon, title, URL, and mark status |
| **Popup** | Quick summary — one-click tab reload/mark trigger |
| **Content script** | Injected on every page — receives favicon overlay instructions from the background |
| **Configurable thresholds** | Young / middle / old day boundaries saved in `browser.storage.local` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  background.ts (service worker)          │
│   • browser.alarms → daily tab scan                     │
│   • BackgroundTabService.loadAndMarkTabs()              │
│   • Writes snapshot → browser.storage.local             │
│   • NO Pinia (isolated VM)                              │
└──────────────────────┬──────────────────────────────────┘
                       │ browser.storage.onChanged
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      popup/        options/    content/
    App.vue        App.vue      App.vue
   (Pinia)        (Pinia)    (minimal UI)
  TabStore       TabStore
  .initStorageSync()
```

**Key design decisions:**
- Background is the **"server"** — manages all tab logic, no Pinia
- `browser.storage.local` is the **single source of truth** (cross-context)
- UI contexts (popup, options) use **Pinia + `TabStore.initStorageSync()`** to stay in sync via `storage.onChanged`
- `StorageService` wraps `browser.storage.local` with localStorage fallback for tests

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [WXT](https://wxt.dev) — MV3, Chrome + Firefox |
| UI | Vue 3 `<script setup lang="ts">` + [Quasar](https://quasar.dev) |
| State | Pinia (UI contexts only) |
| Styling | Quasar components + `src/assets/global.css` (`got-*` classes) |
| HTTP | axios |
| Dates | dayjs |
| Unit tests | Vitest + jsdom + `@vue/test-utils` |
| E2E tests | Playwright + real Chromium (no mocks) |
| Build | WXT + Vite |

---

## Project Structure

```
src/
├── entrypoints/
│   ├── background.ts          # Service worker — alarms, tab events
│   ├── popup/                 # Extension popup (Vue app)
│   ├── options/               # Full options page (Vue app)
│   ├── content/               # Content script (injected on every page)
│   └── shared/
│       └── AppBootstrapper.ts # Shared Vue + Pinia + Quasar setup
├── stores/
│   ├── TabStore.ts            # Tab state + storage sync
│   └── globalStore.ts         # Settings (thresholds, flags)
├── services/
│   ├── BackgroundTabService.ts # Tab logic for background (no Pinia)
│   ├── TabDots.ts             # Favicon L-bracket rendering + injection
│   ├── StorageService.ts      # browser.storage.local wrapper
│   ├── TabUpdateService.ts    # Tab classification helpers
│   └── ExtensionCleanupService.ts
├── models/tabs/               # TypeScript models
│   ├── ClassifiedTab.ts
│   ├── TabRow.ts
│   ├── TabsSnapshot.ts
│   └── AgeClassification.ts
└── assets/global.css          # Global branding (got-* CSS classes)

test/
├── unit/                      # Vitest — fast, jsdom, mocked browser APIs
└── playwright/                # Playwright — real Chromium, real extension
```

---

## Setup

```bash
# Install dependencies + download Playwright Chromium
npm install

# Or manually:
npm run install:chromium
```

**Requirements:** Node.js ≥ 22

---

## Development

```bash
# Chrome (uses Playwright's Chromium)
npm run dev

# Firefox
npm run dev:firefox

# Build for both browsers
npm run build
```

---

## Testing

The project has **two separate test layers** — choose based on what you need to verify:

### Layer 1 — Unit Tests (Vitest + jsdom) — fast, isolated

```bash
npm run test:unit          # run once
npm run test:unit:watch    # watch mode
```

- **Speed:** ~2–3 seconds
- **Isolation:** mocked `browser.*` APIs via `vi.mock('webextension-polyfill', ...)`
- **What to test:** store logic, service methods, component rendering, data transformations
- **11 test files, 83 tests**

### Layer 2 — E2E Tests (Playwright + real Chromium) — real browser, no mocks

```bash
npm run test:playwright         # build + run E2E
SKIP_BUILD=1 npm run test:playwright  # skip build (use existing .output/)

# Interactive UI mode
npm run test:playwright:ui
```

- **Real browser:** actual Chromium via `chromium.launchPersistentContext()`
- **Real extension:** loaded via `--load-extension=.output/chrome-mv3`
- **Real APIs:** `browser.storage`, `browser.tabs`, `browser.scripting` — no mocks
- **What to test:** full extension lifecycle, popup/options mounting, content script injection, favicon overlay
- **Covers:** MV3 service worker startup, extension ID resolution, cross-page messaging

```bash
# Run all
npm run test

# Type check + unit + build (CI)
npm run ci
```

### Why two layers?

| | Vitest (unit) | Playwright (E2E) |
|---|---|---|
| Speed | ⚡ 2–3s | 🐢 30–60s |
| Browser | jsdom (simulated) | **Real Chromium** |
| `browser.*` APIs | Mocked with `vi.mock` | Real browser APIs |
| Use for | Logic, components, stores | Extension lifecycle, real behavior |
| Confidence | Logic correctness | "Does it actually work?" |

> **Playwright with real Chromium is the only way to be 100% sure** the extension behaves correctly — service workers, `executeScript`, `storage.onChanged`, favicon injection all run in the real browser engine.

---

## Build

```bash
# Production build (Chrome MV3 + Firefox MV3)
npm run build

# Create .xpi / .zip for publishing
npm run zip
```

Output directories:
- `.output/chrome-mv3/` — Chrome extension
- `.output/firefox-mv3/` — Firefox extension

---

## Browser Compatibility

| Browser | Support | Notes |
|---|---|---|
| Chrome / Chromium | ✅ Primary | MV3, full Playwright E2E support |
| Firefox | ✅ Secondary | MV3 (Gecko), manual testing + dev server |
| Edge | ✅ | Chromium-based, same as Chrome |

---

## Key Commands

```bash
npm run dev              # Start dev server (Chrome)
npm run build            # Build for Chrome + Firefox
npm run test:unit        # Unit tests (fast, mocked)
npm run test:playwright  # E2E tests (real Chromium)
npm run test             # Both test suites
npm run ci               # type-check + unit + build
npm run lint             # ESLint fix
npm run format           # Prettier
```
