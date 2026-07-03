// ─── App-wide constants ───────────────────────────────────────────────────────
import packageJson from "../package.json" with {type: "json"};
import dayjs from "dayjs";

/**
 * Theme colors mapping: color name → hex value.
 * PRIMARY SOURCE OF TRUTH for all colors in the application.
 * Used for: Chrome/Firefox tab groups API + CSS styling + inline styles.
 */
export enum ThemeColor {
  Green = 'green',
  Blue = 'blue',
  Yellow = 'yellow',
  Orange = 'orange',
  Red = 'red',
  Pink = 'pink',
  Purple = 'purple',
  Grey = 'grey',
  Cyan = 'cyan',
}

/**
 * Threshold level keys — PRIMARY SOURCE OF TRUTH for unique identifiers.
 * Used throughout app for threshold configuration and grouping logic.
 */
export enum ThresholdKey {
  WEEK = 'WEEK',
  WEEKS_2 = 'WEEKS_2',
  MONTH = 'MONTH',
  QUARTERS = 'QUARTERS',
  YEARS = 'YEARS',
}

/**
 * Threshold level display labels — PRIMARY SOURCE OF TRUTH for UI text.
 * Used in tab group titles, threshold inputs, and UI labels.
 */
export enum ThresholdLabel {
  WEEK = 'Week+',
  WEEKS_2 = '2 Weeks+',
  MONTH = 'Month+',
  QUARTERS = 'Quarter+',
  YEARS = 'Eat that frog!',
}

/** Single threshold level configuration: key + label + days + color name. */
export type ThresholdLevel = {
  key: string
  label: string
  days: number
  /** Color name from ThemeColor enum */
  color: ThemeColor
}

/** Single place to change any app-wide constant. Replaces AppConfig + globals.ts. */
export const APP_CONSTANTS = {
  APP_NAME: 'Tab Age Tracker',
  APP_ID: 'TabAgeTracker',
  STORE_GLOBAL_STORE: 'global_store',
  STORE_TAB_STORE: 'tab_store',
  APP_VERSION: `${packageJson.version}-${dayjs().format('YYYYMMDD-HH:mm')}`,
} as const

export const APP_DEFAULTS = {
  // Background alarm for daily tab grouping (24 hours)
  ALARM_UPDATE_TABS: 'updateTabsDaily',
  // Background alarm for hourly backup (1 hour)
  ALARM_BACKUP_TABS: 'backupTabsHourly',
  // WXT Storage key for tab history
  TAB_HISTORY_KEY: 'local:tab_history',

  // Tab age marking thresholds — all presets with labels, days, and color names.
  THRESHOLDS: {
    /** How many threshold levels are active and editable (from youngest).
     *  Can be set from 1 to the total number of presets. Default is 3. */
    activeLevels: 5,

    // First activeLevels items (from start) are used as active thresholds.
    // Colors reference ThemeColor enum:
    // - Chrome/Firefox tab groups API uses color names directly
    presets: [
      {key: ThresholdKey.WEEK, label: ThresholdLabel.WEEK, days: 7, color: ThemeColor.Green},
      {key: ThresholdKey.WEEKS_2, label: ThresholdLabel.WEEKS_2, days: 14, color: ThemeColor.Blue},
      {key: ThresholdKey.MONTH, label: ThresholdLabel.MONTH, days: 28, color: ThemeColor.Orange},
      {key: ThresholdKey.QUARTERS, label: ThresholdLabel.QUARTERS, days: 90, color: ThemeColor.Red},
      {key: ThresholdKey.YEARS, label: ThresholdLabel.YEARS, days: 365, color: ThemeColor.Pink},
    ] as const satisfies readonly ThresholdLevel[],
  },
}

/**
 * Set to `true` for Playwright testing (dev features visible in production build).
 * Set to `false` for actual production release.
 * SINGLE PLACE TO CHANGE — tests vs production.
 */
export const isDevEnv = import.meta.env?.DEV === true || import.meta.env?.VITE_DEV_FEATURES === 'true'

// ─── Environment banner ──────────────────────────────────────────────
if (isDevEnv) {
  console.log(
    `%c
╔══════════════════════════════════╗
║        🔧  ARCHIVUM  🔧         ║
║     DEVELOPMENT MODE             ║
║  Dev features: VISIBLE           ║
╚══════════════════════════════════╝`,
    'color:#ff6d00;font-weight:bold'
  )
} else {
  console.log(
    `%c
╔══════════════════════════════════╗
║        📦  ARCHIVUM  📦         ║
║     PRODUCTION BUILD             ║
║  Dev features: HIDDEN            ║
╚══════════════════════════════════╝`,
    'color:#1565c0;font-weight:bold'
  )
}

// Background service worker message action constants
// Imported by: background.ts (action handlers), UI components, and E2E tests
export const BACKGROUND_MESSAGE_ACTIONS = {
  GROUP_TABS_BY_AGE: 'groupTabsByAge',
  SORT_TABS_BY_DOMAIN: 'sortTabsByDomain',
  UNGROUP_ALL_TABS: 'ungroupAllTabs',
  CREATE_MOCK_TABS: 'createMockTabs',
  GET_TABS: 'getTabs',
  ON_TAB_ACTIVATED: 'onTabActivated',
  HAS_PLUGIN_GROUPS: 'hasPluginGroups',
  CLOSE_TAB: 'closeTab',
  BACKUP_TABS: 'backupTabs',
  RESTORE_TABS: 'restoreTabs',
} as const

/**
 * ── ThemeColor → hex map (brand-aligned) ─────────────────────────────
 * Used for inline table styling via AgeClassification.inlineStyle.
 */
export const THEME_COLOR_HEX: Record<string, string> = {
  [ThemeColor.Green]: '#588a66',
  [ThemeColor.Blue]: '#3867A4',
  [ThemeColor.Yellow]: '#d4a84b',
  [ThemeColor.Orange]: '#d47a2a',
  [ThemeColor.Red]: '#b85a4a',
  [ThemeColor.Pink]: '#b56073',
  [ThemeColor.Purple]: '#7d5394',
  [ThemeColor.Grey]: '#8a8a8a',
  [ThemeColor.Cyan]: '#5d9aa8',
}
