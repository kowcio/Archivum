---
applyTo: '**/*.spec.ts'
---

# Test Rules (auto-applied)

## Layer Decision

| File path                      | Layer | Tool                       |
| ------------------------------ | ----- | -------------------------- |
| `test/unit/**/*.spec.ts`       | Unit  | Vitest + jsdom             |
| `test/playwright/**/*.spec.ts` | E2E   | Playwright + real Chromium |

**Unit when**: store logic, service methods, component rendering, error states  
**E2E when**: `browser.storage`, service worker lifecycle, favicon injection, real navigation

## Required in every unit test file

```ts
// 1. vi.mock() FIRST — before all imports (Vitest hoists it)
vi.mock('webextension-polyfill', () => ({
  default: {
    tabs: {
      query: vi.fn(),
      remove: vi.fn(),
      get: vi.fn(),
      update: vi.fn(),
      onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    storage: {
      local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
    },
    scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn(), setIcon: vi.fn() },
    runtime: { sendMessage: vi.fn(), onMessage: { addListener: vi.fn() } },
  },
}));

// 2. Subject imports after mocks
// 3. beforeEach always:
beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
});
// 4. await flushPromises() after mount() with async onMounted
// 5. Mock storage.onChanged if component calls initStorageSync()
```

## Commands

```bash
npm run test:unit                              # Vitest (watch)
SKIP_BUILD=1 npm run test:playwright          # E2E skip rebuild
```
