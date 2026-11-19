# Archivum – building from source (for add-on reviewers)

## Requirements

- Node.js 24 or newer (see `engines` in `package.json`)
- npm 10 or newer
- Works on Linux, macOS and Windows. No other tools or accounts are needed.

## Build steps

```sh
npm ci
npx wxt zip -b firefox --mv3
```

`npm ci` installs the exact dependency versions from `package-lock.json`.
Its `postinstall` script runs `wxt prepare`, which generates WXT's type files.

`wxt zip` makes a production build and packages it:

- Unpacked extension: `.output/firefox-mv3/`
- Packaged extension: `.output/archivum-<version>-firefox-<timestamp>.zip`

## Notes

- **Version number:** `manifest.version` is generated at build time from the
  local date and time (`1.YY.MDD.HMM`, see `generateBuildVersion()` in
  `wxt.config.ts`). A rebuild therefore differs from the submitted package
  only in `manifest.json` → `version`.
- **Bundler:** WXT (Vite + Rollup). The output is minified but not obfuscated.
  There is no remote code, `eval` or `new Function`.
- **`innerHTML` lint warning:** it comes from the Vue 3 runtime
  (`insertStaticContent` in `@vue/runtime-dom`), which inserts static template
  HTML produced by the Vue compiler at build time. The add-on's own code in
  `src/` does not use `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `v-html`.
- **Source layout:** `src/entrypoints/` contains the background script, popup
  and options pages. Shared Vue components are in `src/components/`, and tab
  and storage logic in `src/services/` and `src/store/`.
