import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import webExt from 'web-ext';

(async function runFirefox() {
  const distDir = path.resolve('./dist');

  console.log('🦊 Preparing to run Firefox with the extension...');

  // Check if the dist directory exists
  if (!fs.existsSync(distDir)) {
    console.log('📦 dist directory not found. Building the extension...');
    try {
      execSync('npm run extension:build', { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Failed to build the extension:', error.message);
      process.exit(1);
    }
  }

  console.log('🚀 Launching Firefox with the extension...');

  try {
    const runner = await webExt.cmd.run(
      {
        sourceDir: distDir,
        firefox: 'C:/Program Files/Mozilla Firefox/firefox.exe', // Updated to Firefox Developer Edition path
        browserConsole: true,
        startUrl: ['about:debugging#/runtime/this-firefox'],
        noReload: false,
      },
      { shouldExitProgram: false }
    );

    console.log('✅ Firefox is running with the extension loaded. Press Ctrl+C to stop.');

    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping Firefox...');
      await runner.exit();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Failed to run Firefox:', error.message);
    process.exit(1);
  }
})();
