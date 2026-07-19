# 🎯 Quick Reference - Build & Distribution Commands

## 🔨 Build Commands

### Development

```bash
npm run dev                    # Dev mode (Chrome with HMR)
npm run dev:firefox          # Dev mode (Firefox)
```

### Production Builds

```bash
npm run build                # Build both Chrome + Firefox
npm run build:test:chrome    # Build Chrome with test features
npm run build:test:firefox   # Build Firefox with test features
```

### Packaging (Distribution)

```bash
npm run zip                  # Chrome only (.zip)
npm run zip:firefox          # Firefox only (.zip)
npm run zip:edge             # Edge only (.zip)
npm run zip:all              # All 3 browsers
npm run release              # FULL: type-check → build → zip:all
```

### Testing

```bash
npm run test:unit                    # Unit tests (Vitest)
npm run test:playwright:chromium     # E2E tests (Chrome)
npm run test:playwright:firefox      # E2E tests (Firefox)
npm run test                         # Full test suite
```

---

## 📦 Output Files

After `npm run release`:

```
.output/
├── archivum-1.0.0-chrome-202607042131.zip      ← Chrome Web Store
├── archivum-1.0.0-firefox-202607042131.zip     ← Firefox Add-ons
├── archivum-1.0.0-edge-202607042131.zip        ← Edge Add-ons
├── archivum-1.0.0-sources.zip                  ← Firefox source review
├── chrome-mv3/                                  (build artifacts)
├── firefox-mv3/                                 (build artifacts)
└── edge-mv3/                                    (build artifacts)
```

**File Sizes:** ~787 KB each (Chrome/Firefox/Edge), ~2.2 MB (sources)

---

## 🏪 Store Submission URLs

### Chrome Web Store

- **URL:** https://chrome.google.com/webstore/devconsole
- **File:** `archivum-1.0.0-chrome-*.zip`
- **Time to approve:** 1-3 hours typically
- **Auto-updates:** ✅ Yes

### Firefox Add-ons

- **URL:** https://addons.mozilla.org/developers
- **File:** `archivum-1.0.0-firefox-*.zip`
- **Note:** Include `SOURCE_CODE_REVIEW.md` or build instructions
- **Time to approve:** 3-7 days
- **Auto-updates:** ✅ Yes

### Edge Add-ons

- **URL:** https://partner.microsoft.com/dashboard
- **File:** `archivum-1.0.0-edge-*.zip`
- **Time to approve:** 3-7 days
- **Auto-updates:** ✅ Yes

---

## 📝 Pre-Release Checklist

```bash
# 1. Verify code quality
npm run type-check          # TypeScript errors?
npm run lint                # Code style issues?

# 2. Run tests
npm run test:unit           # All unit tests pass?
npm run test:playwright:chromium    # E2E tests pass?

# 3. Build for distribution
npm run release             # Creates all .zip files

# 4. Verify packages
unzip -t .output/archivum-1.0.0-chrome-*.zip
unzip -t .output/archivum-1.0.0-firefox-*.zip
unzip -t .output/archivum-1.0.0-edge-*.zip

# 5. Test manually
# Install each .zip on actual browsers
# Test core features (grouping, backup, restore)
```

---

## 🌐 Distribution Options

### Option 1: Official Stores (Maximum Reach)

```bash
npm run release              # Build packages
# Upload to Chrome + Firefox + Edge (see URLs above)
# Wait 1-3 hours (Chrome) or 3-7 days (Firefox/Edge)
# Publish ✅
```

**Timeline:** 1-7 days
**Reach:** Millions of users
**Auto-update:** ✅ Built-in

### Option 2: Your Blog (Direct Control)

```bash
# Enable self-hosting in wxt.config.ts
# Uncomment: update_url: 'https://yourblog.pl/extensions/archivum/update.json'

npm run release              # Rebuild with update_url
# Upload .zip files to yourblog.pl/extensions/archivum/
# Create update.json (template in docs/)
# Share download link on blog
```

**Timeline:** Immediate
**Reach:** Your audience
**Auto-update:** ✅ Via update.json

### Option 3: GitHub (Developer Community)

```bash
git tag v1.0.0
git push origin v1.0.0
# Create GitHub Release
# Attach .zip files
# Add changelog
```

**Timeline:** 5 minutes
**Reach:** Developers
**Auto-update:** ❌ Manual

### Option 4: Hybrid (RECOMMENDED)

Do all three! See `LAUNCH_READY.md` for detailed strategy.

---

## 🔄 Update Workflow

### Official Stores

1. Update version in `wxt.config.ts` + `package.json`
2. `npm run release`
3. Upload new ZIP to store
4. Users get update automatically

### Self-Hosted

1. Update version in `wxt.config.ts` + `package.json`
2. `npm run release`
3. Upload new .zip to yourblog.pl/extensions/archivum/
4. Update `update.json` with new version
5. Users get update automatically

### Schedule

- **Chrome Web Store:** Updates within 24 hours typically
- **Firefox Add-ons:** Updates within 1-3 days
- **Edge Add-ons:** Updates within 1-3 days
- **Self-hosted:** Updates on next browser check (5 hours to 24 hours)

---

## 📊 WXT Version Info

```
WXT: v0.20.26
Manifest: v3 (MV3)
Browsers: Chrome, Firefox, Edge, Safari
Build tool: Vite v8.0.13
Framework: Vue 3 + TypeScript
```

---

## 🚀 One-Command Release

```bash
# Everything in one command:
npm run release

# This does:
# 1. Type checking (vue-tsc)
# 2. Build Chrome (wxt build -b chrome)
# 3. Build Firefox (wxt build -b firefox)
# 4. Zip Chrome
# 5. Zip Firefox
# 6. Zip Edge
# 7. List all files
# 8. Show file sizes
```

---

## 💡 Pro Tips

**Tip 1: Test Locally First**

```bash
# Extract and test zip before submitting
unzip -d /tmp/test-extension .output/archivum-1.0.0-chrome-*.zip
# Then drag /tmp/test-extension folder to chrome://extensions
```

**Tip 2: Version Consistency**
Keep these in sync:

- `wxt.config.ts` → `manifest.version`
- `package.json` → `version`
- Git tag → `v1.0.0`

**Tip 3: Changelog Management**

```bash
# Before release, create CHANGELOG.md or update RELEASE_NOTES.md
# Include:
# - New features
# - Bug fixes
# - Breaking changes (if any)
# - Known issues
```

**Tip 4: Backup Before Changes**

```bash
git tag v1.0.0-release-backup
# Then make changes for next version
```

---

## 🆘 Troubleshooting

**Build fails?**

```bash
npm run type-check  # Check TS errors
npm run lint        # Check linting
npm run build       # Try full build
```

**ZIP is corrupt?**

```bash
unzip -t .output/*.zip  # Test each zip
npm run release         # Rebuild
```

**Package.json conflicts?**

```bash
rm -rf node_modules package-lock.json
npm install
npm run release
```

**Tests failing before release?**

```bash
npm run test:unit
npm run test:playwright:chromium
# Fix failing tests before releasing!
```

---

## 📚 See Also

- `docs/BUILD_AND_DISTRIBUTION.md` - Complete guide
- `docs/DISTRIBUTION_GUIDE.md` - Store-specific steps
- `docs/LAUNCH_READY.md` - Pre-launch checklist
- `docs/BLOG_POST_TEMPLATE.md` - Blog content
- `wxt.config.ts` - Build configuration

---

## 🎯 TL;DR

```bash
# Development
npm run dev              # Live reload

# Testing
npm run test             # All tests

# Release
npm run release          # Creates .zip files in .output/

# Submit
# Upload .zip files to Chrome, Firefox, Edge stores
# OR host on your blog
# OR both!
```

**Done!** Your extension is ready to launch. 🚀
