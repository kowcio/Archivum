import { chromium, firefox, type BrowserContext } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const OUTPUT_DIR = path.resolve(process.cwd(), '.output')

function ensureProfileDir(name: string): string {
  const dir = path.join(OUTPUT_DIR, name)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export async function launchChromeMv3Context(): Promise<{ context: BrowserContext; extId: string }> {
  const extensionPath = path.join(OUTPUT_DIR, 'chrome-mv3')
  const normalizedExtensionPath = extensionPath.replace(/\\/g, '/')
  if (!fs.existsSync(extensionPath)) {
    throw new Error(`Chrome MV3 extension not found at ${extensionPath}`)
  }

  const userDataDir = ensureProfileDir('pw-profile-chrome')
  const launchArgs = [
    `--disable-extensions-except=${normalizedExtensionPath}`,
    `--load-extension=${normalizedExtensionPath}`,
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ]
  // Extensions require non-headless mode; Chrome 110 does not support --headless=new
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium', // Changed from 'chrome' to 'chromium' for Playwright
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: launchArgs,
  })

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 30000 })
  const swUrl = worker.url()
  const extId = new URL(swUrl).host
  return { context, extId }
}

export async function launchFirefoxMv3Context(): Promise<{ context: BrowserContext; extId: string }> {
  const extensionPath = path.join(OUTPUT_DIR, 'firefox-mv3')
  if (!fs.existsSync(extensionPath)) {
    throw new Error(`Firefox MV3 extension not found at ${extensionPath}`)
  }

  const userDataDir = ensureProfileDir('pw-profile-firefox')
  const context = await firefox.launchPersistentContext(userDataDir, {
    headless: true,
    firefoxUserPrefs: {
      'xpinstall.signatures.required': false,
      'extensions.experiments.enabled': true, // allow MV3 experiments
    },
  })

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15000 })
  const swUrl = worker.url()
  const extId = new URL(swUrl).host
  return { context, extId }
}

/**
 * Launch Firefox with GUI (not headless) for manual investigation
 * Builds extension for Firefox, loads it, and opens options page
 */
export async function launchFirefoxMv3ContextWithGUI(): Promise<{ context: BrowserContext; extId: string }> {
  // Build extension for Firefox
  console.log('🔨 Building Firefox MV3 extension...')
  try {
    execSync('npm run build', { stdio: 'pipe', cwd: process.cwd() })
    console.log('✅ Build completed')
  } catch (error) {
    console.warn('⚠️  Build finished (may include warnings)')
  }

  const extensionPath = path.resolve(process.cwd(), '.output', 'firefox-mv3')
  if (!fs.existsSync(extensionPath)) {
    throw new Error(`Firefox MV3 extension not found at ${extensionPath}`)
  }

  const userDataDir = ensureProfileDir('pw-profile-firefox-gui')

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('🚀 Launching Firefox with GUI (headless: false)...')
  console.log(`📁 Extension path: ${extensionPath}`)
  console.log(`👤 Profile dir: ${userDataDir}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  // IMPORTANT: Firefox MV3 support in Playwright is limited
  // Using headless mode FIRST to discover extension ID, then GUI mode
  console.log('📡 Step 1: Discovering extension ID (headless)...')

  const headlessContext = await firefox.launchPersistentContext(ensureProfileDir('pw-profile-firefox-headless-temp'), {
    headless: true,
    firefoxUserPrefs: {
      'xpinstall.signatures.required': false,
      'extensions.experiments.enabled': true,
    },
  })

  let extId: string | null = null

  try {
    // Wait for service worker in headless mode
    const worker = await headlessContext.waitForEvent('serviceworker', { timeout: 10000 })
    const swUrl = worker.url()
    extId = new URL(swUrl).host
    console.log(`✅ Found extension ID: ${extId}`)
  } catch (error) {
    console.log('⚠️  Service worker event failed, trying alternative method...')

    // Alternative: check service workers list
    const workers = headlessContext.serviceWorkers()
    if (workers.length > 0) {
      const swUrl = workers[0].url()
      extId = new URL(swUrl).host
      console.log(`✅ Found extension ID from service workers list: ${extId}`)
    }
  }

  await headlessContext.close()

  if (!extId) {
    // If we still don't have ID, use a generic one
    // Firefox will assign a temporary ID when loading unsigned extensions
    extId = 'browserextension@local'
    console.log(`⚠️  Using placeholder extension ID: ${extId}`)
  }

  console.log('\n📡 Step 2: Launching Firefox GUI mode...')

  // Now launch the actual GUI context
  const context = await firefox.launchPersistentContext(userDataDir, {
    headless: false, // GUI mode – user can investigate
    firefoxUserPrefs: {
      'xpinstall.signatures.required': false,
      'extensions.experiments.enabled': true,
      'devtools.chrome.enabled': true,
      'browser.startup.homepage': `moz-extension://${extId}/options.html`,
    },
  })

  console.log(`\n✅ Extension ID: ${extId}`)
  console.log(`🔗 Extension URL: moz-extension://${extId}/`)
  console.log(`\n📍 Firefox GUI is now running!`)

  return { context, extId }
}

