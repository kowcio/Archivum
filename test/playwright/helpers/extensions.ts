import { chromium, type BrowserContext } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const OUTPUT_DIR = path.resolve(process.cwd(), '.output')

export const BROWSER_WIDTH  = 1280
export const BROWSER_HEIGHT = 800

function ensureProfileDir(name: string): string {
  const dir = path.join(OUTPUT_DIR, name)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export async function launchChromeMv3Context(): Promise<{ context: BrowserContext; extId: string; cleanup: () => Promise<void> }> {
  const extensionPath = path.join(OUTPUT_DIR, 'chrome-mv3')
  const normalizedExtensionPath = extensionPath.replace(/\\/g, '/')
  if (!fs.existsSync(extensionPath)) {
    throw new Error(`Chrome MV3 extension not found at ${extensionPath}`)
  }

  const profileName = `pw-profile-chrome-${crypto.randomUUID()}`
  const userDataDir = ensureProfileDir(profileName)
  const launchArgs = [
    `--disable-extensions-except=${normalizedExtensionPath}`,
    `--load-extension=${normalizedExtensionPath}`,

    // ── Sandbox & memory ────────────────────────────────────────────────────
    '--no-sandbox',
    '--disable-dev-shm-usage',              // Use /tmp instead of /dev/shm (CI stability)

    // ── Background tab throttling — CRITICAL for loadMockTabs() ────────────
    // Chrome throttles background tabs by default (timers, rendering, network).
    // Our mock tabs are opened with active:false → without these flags favicons
    // and page loads are severely delayed or never complete.
    '--disable-background-timer-throttling',     // JS timers run at full speed in bg tabs
    '--disable-renderer-backgrounding',           // Renderer process not deprioritised for bg tabs
    '--disable-backgrounding-occluded-windows',  // Occluded windows not throttled

    // ── Network & favicon loading ────────────────────────────────────────────
    '--disable-ipc-flooding-protection',  // Prevents IPC message rate-limiting during heavy tab load

    // ── Reduce noise / interruptions ────────────────────────────────────────
    '--no-first-run',                     // Skip "Welcome to Chrome" screen
    '--no-default-browser-check',         // Skip "Make Chrome default?" prompt
    '--disable-sync',                     // No Google account sync overhead
    '--disable-translate',                // No "Translate this page?" bar
    '--disable-notifications',            // No permission popups for notifications
    '--disable-features=TranslateUI',     // Disable translate UI feature flag

    // ── Window size ─────────────────────────────────────────────────────────
    // viewport/launchOptions in playwright.config.ts do NOT apply to
    // launchPersistentContext (used for extensions). Must be set here.
    `--window-size=${BROWSER_WIDTH},${BROWSER_HEIGHT}`,
    '--window-position=100,100',
  ]
  // Extensions require non-headless mode; Chrome 110 does not support --headless=new
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    // headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: launchArgs,
    viewport: { width: BROWSER_WIDTH, height: BROWSER_HEIGHT },
  })

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 30000 })
  const swUrl = worker.url()
  const extId = new URL(swUrl).host

  return {
    context,
    extId,
    cleanup: async () => {
      if (fs.existsSync(userDataDir)) {
        fs.rmSync(userDataDir, { recursive: true, force: true })
      }
    }
  }
}

export async function launchFirefoxMv3Context(): Promise<{ context: BrowserContext; extId: string; cleanup: () => Promise<void> }> {
  const extensionPath = path.join(OUTPUT_DIR, 'firefox-mv3')
  if (!fs.existsSync(extensionPath)) {
    throw new Error(`Firefox MV3 extension not found at ${extensionPath}`)
  }

  const manifest = JSON.parse(
    fs.readFileSync(path.join(extensionPath, 'manifest.json'), 'utf-8')
  )
  const extId = manifest.applications?.gecko?.id || 'default-firefox-ext@test'

  throw new Error(
    `Firefox MV3 extension loading via Playwright persistent context is not supported. ` +
    `Playwright's launchPersistentContext does not support loading unsigned extensions. ` +
    `Use Firefox nightly with a signed extension or test Chrome MV3 instead. ` +
    `Extension path: ${extensionPath}`
  )
}
