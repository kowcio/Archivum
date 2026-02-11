import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

function prepareProfile() {
  const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
  const wxtOutputDir = path.resolve(repoRoot, '.output', 'firefox-mv2')
  const manifestPath = path.resolve(wxtOutputDir, 'manifest.json')
  
  if (!fs.existsSync(manifestPath)) {
    console.log('.output/firefox-mv2/manifest.json not found; building extension...')
    execSync('npm run extension:build', { stdio: 'inherit' })
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const geckoId = manifest.browser_specific_settings?.gecko?.id || 'extension@local'
  const xpiName = geckoId.endsWith('.xpi') ? geckoId : `${geckoId}.xpi`
  const repoXpi = path.resolve(repoRoot, xpiName)

  // If XPI doesn't exist in repo root, create it
  if (!fs.existsSync(repoXpi)) {
    console.log('XPI not found; creating it...')
    execSync('node scripts/package-xpi.js', { stdio: 'inherit' })
  }

  const profileDir = path.resolve(repoRoot, 'test', 'playwright', 'firefox-profile')
  const extensionsDir = path.resolve(profileDir, 'extensions')
  fs.mkdirSync(extensionsDir, { recursive: true })

  const dest = path.resolve(extensionsDir, xpiName)
  fs.copyFileSync(repoXpi, dest)
  console.log('Copied XPI to profile extensions:', dest)
}

prepareProfile()
