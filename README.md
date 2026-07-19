# <img src="src/assets/icon.svg" width="64" height="64" style="display: inline; margin-right: 8px;" /> Archivum

## GitHub

[![Build & Test](https://github.com/kowcio/czynsz_ff/actions/workflows/webpack.yml/badge.svg?branch=main)](https://github.com/kowcio/czynsz_ff/actions/workflows/webpack.yml)
[![Latest Release](https://img.shields.io/github/v/release/kowcio/czynsz_ff)](https://github.com/kowcio/czynsz_ff/releases)

## GitLab

[![Build & Release](https://gitlab.com/kowcio/Archivum/badges/main/pipeline.svg)](https://gitlab.com/kowcio/Archivum/pipelines)

## Tech Stack

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.5-2c3e50.svg?logo=vue.js)](https://vuejs.org/)
[![Pinia](https://img.shields.io/badge/Pinia-3.0-42b983.svg?logo=pinia)](https://pinia.vuejs.org/)
[![WXT](https://img.shields.io/badge/WXT-0.20-ff8a00.svg)](https://wxt.dev/)
[![Quasar](https://img.shields.io/badge/Quasar-2.19-1976d2.svg?logo=quasar)](https://quasar.dev/)

## Browsers

[//]: # '[![Chrome](https://img.shields.io/badge/Chrome-MV3-4285f4.svg?logo=google-chrome)](https://www.chromium.org/)'

[![Firefox](https://img.shields.io/badge/Firefox-MV3-ff7139.svg?logo=firefox-browser)](https://www.mozilla.org/firefox/)

[//]: # '[![Edge](https://img.shields.io/badge/Edge-MV3-0078d4.svg?logo=microsoft-edge)](https://www.microsoft.com/edge)'

## General

[![Node Version](https://img.shields.io/badge/node-%3E%3D24-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Maintained](https://img.shields.io/badge/maintained%3F-yes-green.svg)](#)

> A browser extension that help you track and archive the old tabs.

---

## Status

---

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
