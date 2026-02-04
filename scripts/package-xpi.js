import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
import archiver from 'archiver'

/**
 * Create XPI package for Firefox extension from dist directory (holding built extension files - JS code from Vue and Ts).
 *
 * It verifies the presence of the dist directory and manifest.json, extracts the
 * Gecko ID from the manifest to name the XPI file, removes any existing XPI,
 * and creates a compressed ZIP archive of the dist contents.
 *
 * @throws {Error} If the dist directory or manifest.json is missing.
 */
async function packageXpi() {
  const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
  const distDir = path.resolve(repoRoot, 'dist')
  console.log("Packaging Firefox extension as XPI (just a ZIP with differt extension) from", distDir)
  if (!fs.existsSync(distDir)) {
    throw new Error('dist directory not found. Run `npm run extension:build` first.')
  }

  const manifestPath = path.resolve(distDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json not found in dist. Build may have failed.')
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const geckoId = manifest.browser_specific_settings?.gecko?.id
  if (!geckoId){
    throw new Error('geckoId not found in manifest json.')
  }
  const xpiName = geckoId.endsWith('.xpi') ? geckoId : `${geckoId}.xpi`
  const outPath = path.resolve(repoRoot, xpiName)

  // Remove existing xpi if present
  try {
    fs.unlinkSync(outPath)
  } catch (e) {
  }

  console.log('Packaging XPI:', outPath)
  const output = fs.createWriteStream(outPath)
  const archive = archiver('zip', {zlib: {level: 9}})
  archive.pipe(output)
  archive.directory(distDir, "")

  await archive.finalize()
  await new Promise((res, rej) => output.on('close', res).on('error', rej))

  console.log('XPI created at', outPath)
}

packageXpi().catch(err => {
  console.error(err)
  process.exit(1)
})
