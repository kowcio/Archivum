---
applyTo: "**/*.spec.ts"
---

# Test Rules (auto-applied)

## Layer Decision

| File path | Layer | Tool |
|---|---|---|
| `test/unit/**/*.spec.ts` | Unit | Vitest + jsdom |
| `test/playwright/**/*.spec.ts` | E2E | Playwright + real Chromium |

**Unit when**: store logic, service methods, component rendering, error states  
**E2E when**: `browser.storage`, service worker lifecycle, favicon injection, real navigation

