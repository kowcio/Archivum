---
project: "WXT Browser WebExtension: Vue 3 TS + Pinia + Vite + Vitest"
stack: "WXT 0.20+ + Vue 3.5 + TypeScript 5.8 + Pinia 3 + Vitest 4 + Playwright 1.57"
framework: "WXT (Web eXtension Template) - Native web extension framework"
---

# Project Instructions Router

## Quick Rules
- **TypeScript**: Explicit types, no `any`
- **Vue**: `<script setup lang="ts">` + composables
- **Pinia**: Typed stores with loading/error states
- **Browser**: `webextension-polyfill` namespace
- **Tests**: Mock browser APIs + axios
- **Quality**: Single-purpose, small functions
- **UI Framework**: **Quasar Framework quasar.dev** — use `q-btn`, `q-btn-group`, `q-table`, `q-tooltip` etc. for all UI; apply `got-*` CSS classes from `src/assets/global.css` for branding (orange→blue gradient theme)
- **📛 CRITICAL**: [NO_DOCUMENTATION.md](NO_DOCUMENTATION.md) - Code only, no *.md file generation

## 🎯 WXT Framework Native Patterns (IMPORTANT)
- **Background main()**: MUST be synchronous (`main()` cannot be async)
- **Event listeners**: Register inside `main()` body — NOT outside
- **Periodic tasks**: Use `browser.alarms` instead of `setInterval` for persistence across service worker suspension
- **Entry points**: Use `defineBackground()`, `defineContentScript()`, `defineUnlistedScript()` helpers
- **Context safety**: Content scripts use `ctx` object (provides `ctx.addEventListener`, `ctx.isValid` for lifecycle)
- **Manifest**: Auto-generated from entrypoint definitions — do not edit manually
- **See**: [See see src/entrypoints/background.ts](src/entrypoints/background.ts) for example

## Instruction Files

### For Writing Code
- **Components/Stores/Services**: [instructions/code-writing.md](instructions/code-writing.md)
- **Tests**: [instructions/test-writing.md](instructions/test-writing.md)

### For AI Agents
- **Code Agent**: [agents/code-agent.md](agents/code.agent.md)
- **Test Agent**: [agents/test-agent.md](agents/test.agent.md)

## File Routing

```
# Code files (use instruction template)
src/components/**/*.vue      instructions/code-writing.md
src/stores/**/*.ts           instructions/code-writing.md
src/**/*.ts                  instructions/code-writing.md (services)

# Tests
**/*.spec.ts                 instructions/test-writing.md
src/test/**/*.spec.ts        instructions/test-writing.md
```

## Context7 References
All instructions leverage external docs:
- **WXT Framework**: @context7/wxt (PRIMARY for extension patterns, service workers, lifecycle hooks)
- **Vue Ecosystem**: @context7/vue, @context7/vueuse
- **State Management**: @context7/pinia, @context7/axios
- **Testing**: @context7/vitest, @context7/playwright, @context7/vue/test-utils, @context7/pinia/testing

**When WXT documentation is missing**, check Context7 MCP for:
- Service worker lifecycle (suspension/resumption)
- Content script context safety (`ctx` object)
- Content script to background communication patterns
- Manifest generation from entrypoints
- Browser APIs compatibility (Chrome/Firefox)

## Agent Usage
To invoke an agent for code generation:
```
@workspace Generate [component|store|service] for [description]
Follow agents/code-agent.md

@workspace Write tests for [file]
Follow agents/test-agent.md
```
