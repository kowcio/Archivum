---
project: "Tab Age Browser Extension"
stack: "WXT 0.20+ · Vue 3.5 · TypeScript 5.8 · Pinia 3 · Quasar 2 · Vitest 4 · Playwright 1.60"
---

# Project Instructions

## ⚠️ IMPORTANT: Documentation Policy

**NEVER create documentation, summaries, or reports without explicit user request.**  
Only: implement code changes, fix bugs, run tests. If creating docs is needed, ask first.

---

# Self Improvement Patterns (Reference Only)

**Add patterns here ONLY if discovered during work. Keep this section lean.**

### Pattern 1: Firefox Version Format 
❌ WRONG: `1.26.0711.0920` (leading zeros)  
✅ RIGHT: `1.26.711.920` (no zeros)  
**Fix**: Use `Number()` to strip: `Number("${m.padStart(2,'0')}${d.padStart(2,'0')}")`

### Pattern 2: Unused Dependencies
**Audit**: `grep -r "from '[a-z@]" src/ | cut -d"'" -f2 | sort -u`  
**Prevention**: Before adding pkg → Is it in WXT? Vue 3? Lighter alternative? Actually imported?

### Pattern 3: Dead Code Detection
**Runtime**: Never imported → REMOVE  
**Dev/Test**: Only in test/ → KEEP as devDep  
**Config**: Marked clearly → KEEP but document purpose

### Pattern 4: Chrome Global in page.evaluate() Context
❌ WRONG: `import chrome from "chrome";` (no such package exists)  
✅ RIGHT: `/// <reference types="chrome" />` in test globals  
**Why**: In `page.evaluate()`, chrome API is globally available. Add type reference to globals.d.ts:
```typescript
// test/playwright/globals.d.ts
/// <reference types="chrome" />
// `chrome` is globally available in page.evaluate() context (no import needed)
```

**TypeScript Config Updates**:
- Add `"chrome"` to `"types"` array in ALL tsconfig files:
  - `tsconfig.json` 
  - `tsconfig.app.json`
  - `tsconfig.node.json`
  - `tsconfig.playwright.json`
  - `tsconfig.vitest.json`
- Add `/// <reference types="chrome" />` to `env.d.ts`

**Note**: IntelliJ may show TS2304 error despite fix being correct. This is IDE cache issue. npm run type-check passes ✅. Use File → Invalidate Caches → Restart IntelliJ to clear IDE cache.

---

## Why Groups Must Be Sorted

`browser.tabGroups.query()` returns arbitrary order (NOT sorted). Always sort by `.index`:
```typescript
const groups = await browser.tabGroups.query({ windowId })
const sorted = groups.sort((a, b) => (a.index ?? -1) - (b.index ?? -1))  // ✅ Always sort!
```

---

## 🎯 TabGroups Index System

**Group.index** = position of leftmost tab in group  
**Tabs** have continuous indices (0,1,2,...)  
**Groups** have sparse indices (0,3,5,...) only at group starts

```
Browser visual: [T0][T1][T2] | [T3][T4] | [T5][T6][T7] | [T8]
                Group A       Group B      Group C        Ungrouped
Indices:        0             3            5
```

**GroupTabsByAge()**: Creates groups OLDEST→YOUNGEST (left→right)
- Reverse loop through thresholds
- Groups placed at indices: 0 (Eat that frog), 1 (Quarter+), 2 (Month+), 3 (2Weeks+), 4 (Week+)
- Use `OptionsPage.getAllGroups()` in tests (already sorted ✅)

---

## 📦 Dependencies (LOCKED)

**NEVER re-add** (verified unused): `axios`, `context7`, `@upstash/context7-mcp`, `archiver`, `jsdom`, `@types/jsdom`, `axios-mock-adapter`, `vite-plugin-vue-devtools`, `npm-run-all2`

**Production** (7 kept): `vue`, `pinia`, `quasar`, `@quasar/extras`, `@vueuse/core`, `dayjs`, `webextension-polyfill`

**Dev** (28 kept): WXT, Testing (vitest+happy-dom), Build, Linting, Type-checking

---

## ⚠️ Firefox Version Format (CRITICAL)

Firefox rejects leading zeros in versions.

❌ WRONG: `1.26.0711.0920`  
✅ RIGHT: `1.26.711.920`

**Solution** (in `wxt.config.ts`):
```typescript
const monthDay = Number(`${month.padStart(2, '0')}${day.padStart(2, '0')}`);  // 0711 → 711
const hourMin = Number(`${hours.padStart(2, '0')}${minutes.padStart(2, '0')}`);  // 0920 → 920
return `1.${year}.${monthDay}.${hourMin}`;
```

**Validation**: `npm run build:test:firefox && npx web-ext lint --source-dir .output/firefox-mv3`

Reference: https://mzl.la/3h3mCRu
