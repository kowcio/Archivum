# WXT Quick Reference Guide

## 🚀 Common Commands

```bash
# Development (Hot Reload)
npm run extension:dev        # Start Firefox with hot reload
npm run dev:firefox          # Same as above
npm run dev                  # Start Chrome with hot reload

# Building
npm run build:firefox        # Build for Firefox
npm run build                # Build for Chrome
npm run extension:build      # Build for Firefox (alias)

# Packaging
npm run zip:firefox          # Create Firefox distribution ZIP
npm run extension:package    # Build + Zip for Firefox

# Quality Checks
npm run type-check           # TypeScript type checking
npm run lint                 # ESLint + auto-fix
npm run test:unit            # Run unit tests
npm run test:unit:watch      # Watch mode for tests
```

---

## 📂 Where to Add Code

### Adding a New Popup Feature
```
entrypoints/popup/
├── App.vue          ← Edit this for UI
└── main.ts          ← Add initialization logic here
```

### Adding a New Options Page Feature
```
entrypoints/options/
├── App.vue          ← Edit this for UI
└── main.ts          ← Add initialization logic here
```

### Adding Content Script Logic
```
entrypoints/content/
├── index.ts         ← Content script entry (defines matches, injection mode)
├── App.vue          ← Main content UI component
└── style.css        ← Content-specific styles
```

### Adding Shared Business Logic
```
src/
├── shared/
│   ├── stores/      ← Pinia stores (global state)
│   └── services/    ← Business logic services
├── content/
│   ├── stores/      ← Content-specific stores
│   └── services/    ← Content-specific services
└── models/          ← TypeScript interfaces/types
```

---

## 🎯 WXT Content Script Patterns

### Basic Content Script
```typescript
// entrypoints/example.content.ts
export default defineContentScript({
  matches: ['*://*.example.com/*'],
  main() {
    console.log('Content script loaded!');
  },
});
```

### Content Script with Vue UI
```typescript
// entrypoints/overlay.content/index.ts
import { createApp } from 'vue';
import App from './App.vue';

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  
  async main(ctx) {
    const ui = await createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      append: 'first',
      onMount: (container) => {
        const app = createApp(App);
        app.mount(container);
        return app;
      },
      onRemove: (app) => app?.unmount(),
    });
    
    ui.mount();
  },
});
```

### Content Script with Shadow DOM
```typescript
export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'my-extension-ui',
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const app = createApp(App);
        app.mount(container);
        return app;
      },
    });
    
    ui.mount();
  },
});
```

---

## 🔧 Configuration Options

### Content Script Options
```typescript
defineContentScript({
  // Manifest options
  matches: ['*://*.example.com/*'],
  excludeMatches: ['*://*.example.com/admin/*'],
  runAt: 'document_end', // or 'document_start', 'document_idle'
  allFrames: false,
  world: 'ISOLATED', // or 'MAIN'
  
  // WXT-specific options
  cssInjectionMode: 'ui', // or 'manual', 'manifest'
  
  async main(ctx) {
    // Your code here
  },
});
```

### Runner Configuration (wxt.config.ts)
```typescript
runner: {
  disabled: false,
  binaries: {
    firefox: '/path/to/firefox',
    chrome: '/path/to/chrome',
  },
  startUrls: ['https://example.com'],
  browserConsole: true,
  chromiumArgs: [],
  firefoxPrefs: {},
}
```

---

## 🎨 Styling

### Content Script Styles
```css
/* entrypoints/content/style.css */
/* These styles are injected into the page */
.my-extension-overlay {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
}
```

### Popup/Options Styles
```vue
<!-- entrypoints/popup/App.vue -->
<style scoped>
/* Scoped to component */
.popup-container {
  width: 400px;
  padding: 20px;
}
</style>
```

---

## 🌐 Browser API Access

### Using browser API (Auto-imported)
```typescript
// No import needed! 'browser' is auto-imported globally
async function getCurrentTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

// Storage API
await browser.storage.local.set({ key: 'value' });
const data = await browser.storage.local.get('key');
```

### Using webextension-polyfill (Alternative)
```typescript
import browser from 'webextension-polyfill';
// Use browser API as normal
```

---

## 📦 Adding New Entrypoints

### New HTML Page
```
entrypoints/
└── sidepanel/
    ├── index.html
    ├── main.ts
    └── App.vue
```

### New Background Script
```typescript
// entrypoints/background.ts
export default defineBackground({
  type: 'module',
  main() {
    console.log('Background script loaded');
    
    browser.runtime.onInstalled.addListener(() => {
      console.log('Extension installed');
    });
  },
});
```

### New Unlisted Script
```typescript
// entrypoints/injected.ts
export default defineUnlistedScript({
  main() {
    // Runs in page context
    console.log('Injected script');
  },
});
```

---

## 🔍 Debugging

### Browser Console
- Automatically opens with `npm run extension:dev`
- Shows all console.log from background, content, and popup scripts

### Vue DevTools
- Works in popup and options pages
- Enable in Firefox: about:debugging → This Firefox

### Content Script Debugging
```typescript
console.log('[DEBUG]', 'Message here');
// Shows in browser console (not page console)
```

### TypeScript Errors
```bash
npm run type-check
```

---

## 📊 Build Output Structure

```
.output/
├── chrome-mv3/          # Chrome build (Manifest V3)
├── firefox-mv2/         # Firefox build (Manifest V2)
└── [extension-name].zip # Distribution package
```

Each build contains:
- `manifest.json` - Auto-generated
- `*.html` - HTML pages
- `*.js` - Bundled JavaScript
- `*.css` - Bundled styles
- `assets/` - Images, fonts, etc.

---

## 🎯 Best Practices

### 1. File Organization
```
entrypoints/
  feature.content/
    ├── index.ts      # Entry point
    ├── App.vue       # Main component
    ├── style.css     # Styles
    └── utils.ts      # Helper functions
```

### 2. Import Patterns
```typescript
// ✅ Good - Relative imports in entrypoints
import { useStore } from '../../src/shared/stores/myStore';

// ✅ Good - @ alias in src/ files
import { useStore } from '@/shared/stores/myStore';
```

### 3. State Management
```typescript
// Use Pinia for shared state
const store = useGlobalStore();
await store.init();
```

### 4. Cleanup
```typescript
const ui = await createIntegratedUi(ctx, {
  onMount: (container) => {
    const app = createApp(App);
    app.mount(container);
    return app; // Return for cleanup
  },
  onRemove: (app) => {
    app?.unmount(); // Cleanup
  },
});
```

---

## 🚨 Common Issues

### Issue: Module not found
**Cause**: Import path incorrect
**Fix**: Use relative paths in entrypoints, @ alias in src

### Issue: Hot reload not working
**Cause**: Not in dev mode
**Fix**: Use `npm run extension:dev`

### Issue: Types not found
**Cause**: WXT types not generated
**Fix**: Run `npm run postinstall` or `wxt prepare`

### Issue: Build fails
**Cause**: TypeScript errors
**Fix**: Run `npm run type-check` and fix errors

---

## 📚 Learn More

- [WXT Documentation](https://wxt.dev/)
- [WebExtension API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Vue 3 Docs](https://vuejs.org/)
- [Pinia Docs](https://pinia.vuejs.org/)

---

**Quick Start**: Run `npm run extension:dev` and start coding! 🚀
