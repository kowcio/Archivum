import { chromium, firefox, type BrowserContext } from '@playwright/test'
import fs from 'fs'
import path from 'path'

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
    '--headless=new', // required for extensions in headless Chrome 112+
  ]
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions', '--headless'], // re-enable extensions and let --headless come from args
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
