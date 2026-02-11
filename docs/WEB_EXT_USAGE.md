# Web-Ext Development Scripts

This document describes the new web-ext and wxt integration for running Firefox with the extension during development.

## Dependencies Added

- **web-ext** (^8.3.0): Mozilla's official command-line tool for building, running, and testing WebExtensions
- **wxt** (^0.19.0): Next-gen web extension framework with fast HMR and TypeScript support

## Available Scripts

### 1. `npm run extension:run`
**Basic web-ext run with Firefox**
```bash
npm run extension:run
```
- Builds the extension first
- Runs Firefox with the extension loaded
- Opens browser console for debugging
- Opens the extension debugging page automatically
- Simple CLI-based approach

### 2. `npm run extension:run:nightly`
**Run with Firefox Nightly**
```bash
npm run extension:run:nightly
```
- Same as `extension:run` but uses Firefox Nightly
- Useful for testing against latest Firefox features

### 3. `npm run extension:dev` (Recommended)
**Advanced programmatic runner**
```bash
npm run extension:dev
```
- Uses the `scripts/run-firefox.js` script
- Automatically builds extension if needed
- Opens Firefox with developer tools
- Enables auto-reload on file changes
- Opens extension debugging page
- Better error handling and logging
- Graceful shutdown with Ctrl+C

## Script Files

### `scripts/run-firefox.js`
Advanced Node.js script that uses web-ext programmatically:

**Features:**
- Automatic build verification
- Custom Firefox preferences for debugging
- Auto-reload support
- Browser console enabled
- Developer tools enabled
- Clean process management

**Configuration options in the script:**
```javascript
{
  sourceDir: distDir,              // Extension directory
  firefox: 'firefox',              // Browser: 'firefox', 'nightly', or path
  browserConsole: true,            // Open browser console
  devtools: true,                  // Open developer tools
  startUrl: [...],                 // URLs to open on start
  pref: {...},                     // Firefox preferences
  keepProfileChanges: false,       // Profile persistence
  noReload: false,                 // Enable auto-reload
}
```

### `scripts/prepare-firefox-profile.js`
Prepares Firefox profile with extension for Playwright tests:
- Builds extension if missing
- Creates XPI package if needed
- Copies extension to profile directory

### `scripts/package-xpi.js`
Creates XPI package for distribution:
- Builds ZIP archive from dist directory
- Names file based on manifest gecko ID
- Maximum compression (level 9)

## Usage Examples

### Development Workflow
```bash
# Start development with auto-reload
npm run extension:dev

# Make changes to your code
# Firefox will automatically reload the extension

# Press Ctrl+C to stop
```

### Testing Different Firefox Versions
```bash
# Use regular Firefox
npm run extension:run

# Use Firefox Nightly
npm run extension:run:nightly

# Use custom Firefox (modify run-firefox.js)
# Change: firefox: '/path/to/firefox-developer-edition'
```

### Manual web-ext Commands
You can also use web-ext directly:
```bash
# Run with custom options
npx web-ext run --source-dir=./dist --firefox=firefox --browser-console

# Build and lint
npx web-ext build --source-dir=./dist
npx web-ext lint --source-dir=./dist
```

## Configuration

### Custom Firefox Binary
Edit `scripts/run-firefox.js` and change the `firefox` option:
```javascript
firefox: 'firefox',                    // Use system Firefox
firefox: 'nightly',                    // Use Firefox Nightly
firefox: '/path/to/firefox-dev',       // Use custom path
```

### Custom Preferences
Add or modify preferences in `scripts/run-firefox.js`:
```javascript
pref: {
  'devtools.debugger.remote-enabled': true,
  'devtools.chrome.enabled': true,
  'extensions.autoDisableScopes': 0,
  // Add more preferences as needed
}
```

### Start URLs
Modify the URLs opened when Firefox starts:
```javascript
startUrl: [
  'about:debugging#/runtime/this-firefox',
  'https://your-test-page.com',
]
```

## Troubleshooting

### Firefox not found
If web-ext can't find Firefox, specify the full path:
```javascript
firefox: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',  // Windows
firefox: '/Applications/Firefox.app',                        // macOS
firefox: '/usr/bin/firefox',                                 // Linux
```

### Extension not loading
1. Ensure the extension is built: `npm run extension:build`
2. Check that `dist/manifest.json` exists
3. Verify manifest.json has valid gecko ID

### Auto-reload not working
- Ensure `noReload: false` in the script
- Check that file watching is enabled
- Some file systems (network drives) may not support watching

## WXT Framework (Future)

WXT is included as a dependency for potential future migration:
```bash
# WXT development commands (not yet configured)
wxt                    # Start dev server for Chrome
wxt -b firefox         # Start dev server for Firefox
wxt build              # Build for production
wxt zip -b firefox     # Create distributable ZIP
```

WXT provides:
- Fast HMR (Hot Module Replacement)
- File-based entry points
- TypeScript support out of the box
- Automated publishing workflows

## References

- [web-ext documentation](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/)
- [WXT documentation](https://wxt.dev/)
- [Firefox extension debugging](https://extensionworkshop.com/documentation/develop/debugging/)
