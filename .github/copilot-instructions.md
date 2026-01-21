copilot:
  project: "Browser WebExtension: Vue 3 TS + Pinia + Vite + Vitest"
  
  structure:
    - popup: "AppPopup.vue → popup.html"
    - components: "src/components"
    - stores: "src/stores/*.ts"
    - tests: "test/unit/*.spec.ts"
  
  rules:
    - vue: "<script setup lang='ts'> + composables"
    - pinia: "typed defineStore() + @pinia/testing"
    - firefox: "browser.* namespace + webextension-polyfill"
    - tests: "Vitest jsdom + @vue/test-utils"
    - build: "vite-plugin-web-extension patterns"
    
  quality:
    - "explicit TS types, no any"
    - "small single-purpose functions"
    - "one unit test per feature"
    - "mock axios APIs in tests"
