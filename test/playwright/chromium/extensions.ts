/**
 * Launch Chrome MV3 extension context for Playwright E2E tests.
 * Firefox MV3 unsigned extensions cannot be loaded via Playwright.
 *
 * 🚀 PERFORMANCE OPTIMIZATION: Browser Context Reuse
 * - Browser context is launched ONCE per worker via Playwright fixtures
 * - Context and its pages are recycled between tests (cleanup pages only)
 * - Service worker stays alive in the persistent context
 * - Reduces test overhead from ~2-3s per launch to ~100ms per page creation
 *
 * ARCHITECTURE:
 * 1. Worker scope: Browser context initialized once via fixture
 * 2. Test scope: Each test gets fresh pages, context/browser is shared
 * 3. Cleanup: Per-test cleanup closes pages; worker shutdown closes context
 *
 * ✅ AUTOMATIC DEV ENVIRONMENT MOCKING:
 * Dev features (MockButton, CloseAllTabsButton, etc.) are automatically enabled
 * at runtime via mockDevEnvForTesting(). NO need to build with DEV_FEATURES=true.
 *
 * Tests work directly from IntelliJ without manual build step.
 * To run: npm run test:backup-restore (or use IntelliJ gutter icons)
 */
import { chromium, test, type BrowserContext, type Page } from "@playwright/test";

import fs from "fs";
import path from "path";
import type { BackgroundRPC } from "@/services/BackgroundRPC";
import { OptionsPage } from "../page-objects/OptionsPage.js";

// ✅ Shared context type for all tests
export type ExtensionTestContext = {
  context: BrowserContext;
  extensionId: string;
  cleanup: () => Promise<void>;
};

// ⏱️ SINGLE SOURCE OF TRUTH: All test timeouts (reused across tests)
// Both UI and RPC operations use same 3000ms default - sufficient for CI environments
export const WAIT_MS = 3000;

// ✅ Default timeout for all extension tests
export const EXTENSION_TEST_TIMEOUT = 30_000;
const OUTPUT_DIR = path.resolve(process.cwd(), ".output");

// 🎯 BROWSER CACHE: Module-level cache for the shared persistent context
// Launched once per worker, pages are recycled between tests for performance
let cachedBrowserContext: BrowserContext | null = null;
let cachedExtensionId: string | null = null;

/**
 * Launch shared Chrome persistent context with MV3 extension
 * This is called ONCE per worker and the context is reused across all tests
 */
async function launchChromeBrowser(): Promise<{ context: BrowserContext; extensionId: string }> {
  const extensionPath = path.join(OUTPUT_DIR, "chrome-mv3");
  if (!fs.existsSync(extensionPath)) {
    throw new Error(
      "Chrome MV3 extension not found at " + extensionPath + ". Run build first."
    );
  }

  console.log("[launchChromeBrowser] 🚀 Launching Chrome with MV3 extension (WORKER SCOPE)...");

  const context = await chromium.launchPersistentContext(
    path.join(OUTPUT_DIR, "pw-profile-worker"),
    {
      channel: "chromium",
      headless: true,
      ignoreDefaultArgs: ["--disable-extensions"],
      args: [
        "--disable-extensions-except=" + extensionPath,
        "--load-extension=" + extensionPath,
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        "--disable-ipc-flooding-protection",
        "--no-first-run",
        "--no-default-browser-check",
      ],
      viewport: { width: 1280, height: 800 },
    }
  );

  console.log("[launchChromeBrowser] ⏳ Waiting for extension to load (timeout: 30s)...");

  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker", { timeout: 30000 }));

  const extensionId = new URL(worker.url()).host;
  console.log(`[launchChromeBrowser] ✅ Service worker ready, extension ID: ${extensionId}`);

  return { context, extensionId };
}

/**
 * Get or create the shared browser context (cached per worker)
 */
async function getOrCreateContext(): Promise<{
  context: BrowserContext;
  extensionId: string;
}> {
  if (!cachedBrowserContext) {
    const result = await launchChromeBrowser();
    cachedBrowserContext = result.context;
    cachedExtensionId = result.extensionId;
  }
  return { context: cachedBrowserContext!, extensionId: cachedExtensionId! };
}

/**
 * Reset pages in the shared context for the next test
 */
async function resetContextPages(context: BrowserContext): Promise<void> {
  console.log(
    "[resetContextPages] 🧹 Clearing all pages from shared context..."
  );

  for (const page of context.pages()) {
    try {
      await page.close();
    } catch {
      // Ignore page close errors
    }
  }

  console.log("[resetContextPages] ✅ Context pages reset");
}

export async function launchChromeContext(): Promise<ExtensionTestContext> {
  const { context, extensionId: extId } = await getOrCreateContext();

  // Reset any leftover pages from previous test
  await resetContextPages(context);

  return {
    context,
    extensionId: extId,
    cleanup: async () => {
      try {
        // Close all pages in this context
        await resetContextPages(context);
        console.log('[launchChromeContext.cleanup] ✅ Pages cleaned up (context reused for next test)');
      } catch (err) {
        // Log but don't throw
        console.warn('[launchChromeContext.cleanup] Error during cleanup:', err instanceof Error ? err.message : err);
      }
    },
  };
}

/**
 * Setup service worker console logging for debugging.
 * Captures all console messages from the background service worker.
 *
 * ⚡ Handles SW restarts: attaches to existing workers AND listens
 *    for new ones via context.on('serviceworker').
 *
 * NOTE: Does NOT set up page-level console capture (separate from SW),
 * because context.on('page') fires for every extension-created page
 * (including mock tabs), adding duplicate listeners.
 * Use page.on('console') explicitly in tests if needed.
 *
 * Usage: Call this in beforeAll hook to monitor SW execution.
 */
export function setupServiceWorkerLogging(context: BrowserContext): void {
  function attachWorkerLogging(worker: any): void {
    worker.on('console', (msg: any) => {
      const type = msg.type();
      const text = msg.text();
      // Only log actual service worker messages (contain [BackgroundTabService] or similar markers)
      if (text.includes('[') && text.includes(']')) {
        const prefix = type === 'error' ? '[SW_ERROR]' : '[SW_LOG]';
        console.log(`${prefix} ${text}`);
      }
    });
  }

  // Attach to any existing workers
  for (const worker of context.serviceWorkers()) {
    attachWorkerLogging(worker);
  }

  // Listen for future SW restarts (MV3 suspends/resumes workers)
  context.on('serviceworker', (worker: any) => {
    attachWorkerLogging(worker);
  });

  console.log('[Test] Service worker logging enabled');
}

/**
 * ✅ Setup helper for all extension tests
 * Automatically sets timeout, skips non-Chrome, launches context, enables logging
 * @param withServiceWorkerLogging - Enable service worker console logging (default: true)
 * @param timeoutMs - Custom timeout in milliseconds (default: EXTENSION_TEST_TIMEOUT)
 */
export async function setupExtensionTest(
  withServiceWorkerLogging: boolean = true,
  timeoutMs: number = EXTENSION_TEST_TIMEOUT
): Promise<ExtensionTestContext> {
  test.skip(test.info().project.name !== "chrome-mv3", "Chrome MV3 only");
  test.setTimeout(timeoutMs);

  const ctx = await launchChromeContext();

  if (withServiceWorkerLogging) {
    setupServiceWorkerLogging(ctx.context);
  }

  return ctx;
}

/**
 * Create RPC proxy for calling background service worker methods from tests
 * Wraps chrome.runtime.sendMessage with type-safe BackgroundRPC interface
 */
export function createRPCProxy(page: Page): BackgroundRPC {
  return new Proxy({} as BackgroundRPC, {
    get: (target: any, methodName: string | symbol) => {
      if (typeof methodName === 'symbol') {
        return target[methodName]
      }

  // Return async function that sends RPC message
      return async (...args: any[]) => {
       try {
         return await page.evaluate(
           async (params: { method: string; methodArgs: any[] }) => {
             return new Promise<any>((resolve, reject) => {
               ;(window as any).chrome.runtime.sendMessage(
                 {
                   type: 'proxy-service.background',
                   data: { path: [params.method], args: params.methodArgs },
                   timestamp: Date.now(),
                 },
                 (response: any) => {
                   if ((window as any).chrome.runtime.lastError) {
                     reject(
                       new Error(
                         (window as any).chrome.runtime.lastError.message
                       )
                     )
                   } else if (response?.err) {
                     reject(new Error(response.err.message || 'RPC failed'))
                   } else {
                     resolve(response?.res)
                   }
                 }
               )
             })
           },
           { method: methodName as string, methodArgs: args }
         )
       } catch (err) {
         // Wrap page closed errors for clearer debugging
         if (err instanceof Error && err.message.includes('closed')) {
           throw new Error(`RPC call failed: page or browser context closed (${err.message})`)
         }
         throw err
       }
      }
    },
  })
}

/**
 * Test Environment - all-in-one setup for Options page testing
 * Provides: context, extensionId, and pre-configured OptionsPage POM
 */
export class TestEnvironment {
  optionsPage: OptionsPage;
  extensionId: string;
  private ctx: ExtensionTestContext;
  private cleaned = false;

  private constructor(ctx: ExtensionTestContext, optionsPage: OptionsPage, extensionId: string) {
    this.ctx = ctx;
    this.optionsPage = optionsPage;
    this.extensionId = extensionId;
  }

  static async create(
    withServiceWorkerLogging: boolean = true,
    timeoutMs: number = EXTENSION_TEST_TIMEOUT
  ): Promise<TestEnvironment> {
    const ctx = await setupExtensionTest(withServiceWorkerLogging, timeoutMs);
    const page = await ctx.context.newPage();
    const backgroundRPC = createRPCProxy(page);
    const optionsPage = new OptionsPage(page, backgroundRPC);

    return new TestEnvironment(ctx, optionsPage, ctx.extensionId);
  }

  /**
   * Idempotent cleanup - safe to call multiple times.
   * Only performs actual cleanup on first call.
   */
  async cleanup(): Promise<void> {
    if (this.cleaned) {
      return;
    }
    this.cleaned = true;

    try {
      await this.ctx.cleanup();
    } catch (err) {
      // Log but don't throw - context might already be closed
      console.warn('[TestEnvironment.cleanup] Error during cleanup:', err instanceof Error ? err.message : err);
    }
  }
}

