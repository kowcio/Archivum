```markdown
# Vue 3 Firefox extension guidelines

You are helping build a **Firefox browser extension** written in TypeScript using Vue 3 Composition API, Pinia, Vite, Vitest, and Vue Test Utils. The repository already contains `src`, `stores`, `router`, `test/unit`, `test/playwright`, `manifest.json`, and `vite.config.ts` as shown in the project tree image.

## General architecture

- Treat this project as a WebExtension with a popup UI (`popup.html` / `AppPopup.vue`), content script (`content.js`), and background/service code as defined in `manifest.json`.
- Keep all Vue components in `src/components`, global layout in `App.vue` / `AppPopup.vue`, and app entry in `src/main.ts`.
- Use TypeScript everywhere except config and manifest files; prefer `*.ts` over `*.js` when adding new code.

## Vue 3 and Composition API

- Use `<script setup lang="ts">` for all new Vue 3 components.
- Extract reusable logic into composables under `src/models` or `src/composables` instead of large components.
- Keep components small and focused; move complex async or store logic out of templates and into composables or Pinia actions.

## Pinia store usage

- Put all Pinia stores in `src/stores` with one file per store using `defineStore` and typed state, getters, and actions.
- Avoid accessing `localStorage` or browser APIs directly in components; wrap them in Pinia actions or dedicated utility modules.
- When writing components that depend on Pinia in tests, mount them with `createTestingPinia` from `@pinia/testing` so unit tests stay isolated and deterministic.

## Firefox / multibrowser specifics

- Treat Firefox as the primary target; ensure `manifest.json` remains valid MV2/Firefox WebExtension syntax even if Chrome/MV3 variants are added via `vite-plugin-web-extension` templates.
- Use `webextension-polyfill` and the `browser.*` namespace rather than `chrome.*` so the same code runs in Firefox and other browsers.
- Any code that depends on the current browser (Chrome vs Firefox) should use a compile-time constant like `__BROWSER__` defined via `vite.config.ts` rather than reading `process.env` directly at runtime.

## Vite and build

- Assume Vite is the bundler; keep all extension entry points (`popup.html`, content script, background) registered in `vite.config.ts` using the existing project pattern.
- Do not introduce Webpack-specific or Node-only APIs in browser code; prefer standard ES modules and WebExtension APIs.

## Testing with Vitest and Vue Test Utils

- Place unit tests for components in `test/unit` mirroring the `src` structure and name them `*.spec.ts`.
- Configure Vitest to use the `jsdom` environment via `vitest.config.ts` and reuse the base Vite config with `mergeConfig` when needed.
- In tests, use `@vue/test-utils` for mounting components and keep assertions focused on rendered output and store interaction rather than implementation details.

## Coding style and quality

- Prefer explicit types, avoid `any`, and keep functions small and single-purpose; factor out helpers into separate modules where appropriate.
- Keep imports clean and sorted; remove unused imports and dead code as part of any change.
- For new features, expect at least one unit test (component or store) and update Playwright tests under `test/playwright` when UI behavior changes.

Use these instructions whenever generating or modifying code in this repository so that new code fits the existing Vue 3, Pinia, Vitest, and Firefox extension structure.
```

Copy this directly into `.github/copilot-instructions.md` in your repository root.