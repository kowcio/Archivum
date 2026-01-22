---
project: "Browser WebExtension: Vue 3 TS + Pinia + Vite + Vitest"
stack: "Vue 3.5 + TypeScript 5.8 + Pinia 3 + Vitest 4 + Playwright 1.57"
---

# Project Instructions Router

## Quick Rules
- **TypeScript**: Explicit types, no `any`
- **Vue**: `<script setup lang="ts">` + composables
- **Pinia**: Typed stores with loading/error states
- **Browser**: `webextension-polyfill` namespace
- **Tests**: Mock browser APIs + axios
- **Quality**: Single-purpose, small functions

## Instruction Files

### For Writing Code
- **Components/Stores/Services**: [instructions/code-writing.md](instructions/code-writing.md)
- **Tests**: [instructions/test-writing.md](instructions/test-writing.md)

### For AI Agents
- **Code Agent**: [agents/code-agent.md](agents/code-agent.md)
- **Test Agent**: [agents/test-agent.md](agents/test-agent.md)

## File Routing

```
src/components/**/*.vue     → instructions/code-writing.md
src/stores/**/*.ts          → agents/code-agent.md
src/**/*.ts (services)      

**/*.spec.ts                → instructions/test-writing.md
src/test/**/*.spec.ts       → agents/test-agent.md
```

## Context7 References
All instructions leverage external docs:
- @context7/vue, @context7/vueuse
- @context7/pinia, @context7/axios
- @context7/vitest, @context7/playwright
- @context7/vue/test-utils, @context7/pinia/testing

## Agent Usage
To invoke an agent for code generation:
```
@workspace Generate [component|store|service] for [description]
Follow agents/code-agent.md

@workspace Write tests for [file]
Follow agents/test-agent.md
```
