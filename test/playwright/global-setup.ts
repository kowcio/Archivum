/**
 * Playwright globalSetup — runs ONCE per test run, before any worker starts.
 *
 * Always rebuilds the Chrome MV3 extension from current sources.
 * ⚠️ Without this, tests silently ran against whatever stale `.output/chrome-mv3`
 *    happened to exist (the old check only built when the folder was missing).
 *
 * Done here (not at test-module load) so parallel workers can never race on the same output dir.
 * Set PW_SKIP_BUILD=1 to reuse an existing build when iterating on tests only.
 */
import { execSync } from 'node:child_process'

export default function globalSetup(): void {
  if (process.env.PW_SKIP_BUILD === '1') {
    console.log('[global-setup] ⏭️  PW_SKIP_BUILD=1 — reusing existing .output/chrome-mv3')
    return
  }
  console.log('[global-setup] 🏗️  Building Chrome MV3 extension from current sources...')
  execSync('npx wxt build -b chrome --mv3', { cwd: process.cwd(), stdio: 'inherit' })
}
