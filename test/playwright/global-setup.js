import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

export default async function globalSetup() {
  const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
  console.log('Preparing Firefox profile with extension XPI...')
  execSync('node scripts/prepare-firefox-profile.js', { stdio: 'inherit', cwd: repoRoot })
  console.log('Global setup finished')
}
