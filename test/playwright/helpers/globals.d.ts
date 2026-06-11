/**
 * Global `chrome` declaration for Playwright E2E tests.
 * In page.evaluate(), code runs in extension context where
 * `chrome` is available as a global. This makes TS aware.
 * Uses the chrome namespace from @types/chrome as the variable type.
 */
declare const chrome: Window['chrome'];
