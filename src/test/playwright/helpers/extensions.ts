import { chromium, type BrowserContext } from '@playwright/test'
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
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ]
  // Extensions require non-headless mode; Chrome 110 does not support --headless=new
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: launchArgs,
  })

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 30000 })
  const swUrl = worker.url()
  const extId = new URL(swUrl).host
  return { context, extId }
}

