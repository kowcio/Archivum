# <img src="src/assets/icon.svg" width="64" height="64" style="display: inline; margin-right: 8px;" /> Archivum

**Automatically organize your browser tabs by age. Keep your workspace clean and focused.**

[![Build & Test](https://github.com/kowcio/czynsz_ff/actions/workflows/webpack.yml/badge.svg?branch=main)](https://github.com/kowcio/czynsz_ff/actions/workflows/webpack.yml)
[![Latest Release](https://img.shields.io/github/v/release/kowcio/czynsz_ff)](https://github.com/kowcio/czynsz_ff/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-2c3e50.svg?logo=vue.js)](https://vuejs.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D24-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## 🎯 What is Archivum?

Archivum is a lightweight browser extension that helps you **organize and manage browser tabs by their age**. Instead of having 50+ tabs scattered across your window, Archivum automatically:

- 📊 **Groups tabs by age** into categories:
  - **Week+** (7 days old)
  - **2 Weeks+** (14 days old)
  - **Month+** (28 days old)
  - **Quarter+** (90 days old)
  - **"Eat that frog!"** (365+ days old - time to close them!)

- 🎨 **Visual organization** with color-coded groups for quick recognition
- 🔄 **Smart sorting** by domain or age within groups
- 💾 **Backup & restore** tab collections for later reference
- 🚀 **Auto-grouping** with daily updates
- 🌐 **Cross-browser** support (Chrome, Firefox, Edge via MV3)

---

## ✨ Key Features

### 📅 Automatic Tab Age Tracking
- Tracks when each tab was last accessed
- Automatically updates every 24 hours
- Fresh tabs stay ungrouped (you just opened them!)

### 🎯 Smart Grouping
**[Group Tabs by Age]** - Creates age-based Chrome/Firefox groups:
- Groups organized left to right: **Youngest → Oldest**
- Tabs within each group sorted **by domain** (optional)
- Fresh tabs remain in their original positions

### 📇 Sort Ungrouped Tabs
**[Sort by Domain]** - Organize your fresh/ungrouped tabs alphabetically

### 💾 Backup & Restore
- **Backup**: Save current tab state as JSON
- **Restore**: Recreate closed tabs from backup
- Perfect for session management and recovery

### ⚙️ Customizable Thresholds
Set your own age thresholds in the **Options** page:
- Enable 1-5 active threshold levels
- Adjust days for each level
- Changes apply on next grouping cycle

### 🔧 Development Features
- Mock tab data generator for testing
- Dev tools visible in development builds
- Playwright E2E tests for quality assurance

---

## 🚀 Installation

### From GitHub Releases
1. Visit [Releases](https://github.com/kowcio/czynsz_ff/releases)
2. Download the ZIP file for your browser (Chrome/Firefox/Edge)
3. Extract the ZIP file to a folder
4. Load in your browser:

**Chrome/Edge:**
- Go to `chrome://extensions` or `edge://extensions`
- Enable **Developer mode** (toggle at top-right)
- Click **Load unpacked**
- Select the extracted folder

**Firefox:**
- Go to `about:debugging#/runtime/this-firefox`
- Click **Load Temporary Add-on**
- Select any file in the extracted folder
- Or visit [Firefox Add-ons](https://addons.mozilla.org/) once officially listed

### From Source
```bash
# Install dependencies
npm ci

# Build extension (production)
npm run build

# Build extension (dev mode with mock features)
npm run build:test:chromium

# Create distributable ZIPs
npx wxt zip -b chrome --mv3
npx wxt zip -b firefox --mv3
npx wxt zip -b edge --mv3
```

---

## 📖 Usage Guide

### Getting Started
1. **Open extension popup** - Click Archivum icon in your toolbar
2. **Click "Group Tabs by Age"** - Creates age-based groups from all tabs
3. **View grouped tabs** - Check your tab bar for age-based groups
4. **Customize thresholds** - Visit **Options** to adjust settings

### Workflow Examples

**Keep workspace clean:**
1. Open extension
2. Click "Group Tabs by Age"
3. Focus on fresh tabs (ungrouped, right side)
4. Archive old tabs when ready

**Manage by domain:**
1. Click "Sort by Domain" to alphabetize ungrouped tabs
2. Or toggle "Sort by domain within groups" in Settings

**Preserve sessions:**
1. Click "Backup Tabs" before closing browser
2. Restore later with "Restore Tabs" button

---

## 🏗️ Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| **WXT** | 0.20+ | Browser extension framework |
| **Vue 3** | 3.5+ | UI framework |
| **Pinia** | 3.0+ | State management |
| **TypeScript** | 5.8+ | Type safety |
| **Quasar** | 2.19+ | UI components |
| **Vitest** | 4.1+ | Unit testing |
| **Playwright** | 1.60+ | E2E testing |

---

## 🛠️ Development

### Setup
```bash
npm ci
npm run type-check
npm run lint
npm run format
```

### Run Development Build
```bash
# Chrome/Chromium
npm run dev

# Firefox
npm run dev:firefox

# Edge
npm run dev:edge
```

### Testing

**Unit Tests:**
```bash
npm run test:unit           # Run once
npm run test:unit:watch     # Watch mode
```

**E2E Tests (Playwright):**
```bash
npm run test:playwright:chromium   # Chrome tests
npm run test:playwright:firefox    # Firefox tests
npm run test:playwright            # All browsers
npm run test:playwright:debug      # Debug mode
npm run test:playwright:ui         # UI mode
```

### Build for Distribution
```bash
npm run build              # Type-check + build all browsers
npm run release            # Full pipeline (type-check, lint, test, build, zip, validate)
```

---

## 📊 Important: Sorting Behavior

### 🎯 **Grouping by Age**
- **[Group Tabs by Age]** button creates age-based groups (Week+, Month+, Quarter+, etc.)
- Tabs within each group are **sorted by domain (A→Z) by default** ✅
- This setting can be toggled in **Settings** (⚙️):
  ```
  ☑️ Sort by domain within age groups  [ON by default]
  ```
- If disabled, tabs within groups are sorted by age only (oldest first)

### 🎯 **Sorting Ungrouped Tabs**
- **[Sort by Domain]** button ONLY sorts ungrouped tabs (right side)
- Fresh tabs and manually ungrouped tabs get reordered alphabetically by domain
- This respects your manual workflow — only ungrouped tabs are affected

### ⚠️ **Why This Design?**
- **Groups are stable** — Don't reorder during grouping (respects user intent)
- **Ungrouped tabs stay in order** — Only sort by domain when you explicitly click the button
- **Domain sorting is optional** — Turn it off if you prefer age-only sorting within groups
- **User control** — You choose when to sort, groups don't surprise you

### 📌 **Remember**
- ❌ Cannot reorder tabs **within** a group using the sort button (Chrome API limitation)
- ✅ Can sort **ungrouped** tabs by domain
- ✅ Can toggle domain sorting within groups in Settings

---

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests: `npm run test`
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🐛 Issues & Support

Found a bug or have a feature request? Please [open an issue](https://github.com/kowcio/czynsz_ff/issues)

## Important: Sorting Behavior (Business Model)

### 🎯 **Grouping by Age**
- **[Group Tabs by Age]** button creates age-based groups (Week+, Month+, Quarter+, etc.)
- Tabs within each group are **sorted by domain (A→Z) by default** ✅
- This setting can be toggled in **Settings** (⚙️):
  ```
  ☑️ Sort by domain within age groups  [ON by default]
  ```
- If disabled, tabs within groups are sorted by age only (oldest first)

### 🎯 **Sorting Ungrouped Tabs**
- **[Sort by Domain]** button ONLY sorts ungrouped tabs (right side)
- Fresh tabs and manually ungrouped tabs get reordered alphabetically by domain
- This respects your manual workflow — only ungrouped tabs are affected

### ⚠️ **Why This Design?**
- **Groups are stable** — Don't reorder during grouping (respects user intent)
- **Ungrouped tabs stay in order** — Only sort by domain when you explicitly click the button
- **Domain sorting is optional** — Turn it off if you prefer age-only sorting within groups
- **User control** — You choose when to sort, groups don't surprise you

### 📌 **Remember**
- ❌ Cannot reorder tabs **within** a group using the sort button (Chrome API limitation)
- ✅ Can sort **ungrouped** tabs by domain
- ✅ Can toggle domain sorting within groups in Settings


