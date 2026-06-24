// ─── App-wide constants ───────────────────────────────────────────────────────
import packageJson from "../package.json" with { type: "json" };
import dayjs from "dayjs";

/**
 * Theme colors mapping: color name → hex value.
 * PRIMARY SOURCE OF TRUTH for all colors in the application.
 * Used for: Chrome/Firefox tab groups API + CSS styling + inline styles.
 */
export const THEME_COLORS = {
  green: '#188038',
  blue: '#1f73e7',
  orange: '#ffa500',
  red: '#d33b27',
  pink: '#e91e63',
  purple: '#7c3aed',
  grey: '#9aa0a6',
  cyan: '#00bcd4',
} as const

/** Single threshold level configuration: key + label + days + color name. */
export type ThresholdLevel = {
  key: string
  label: string
  days: number
  /** Color name (key from THEME_COLORS) */
  color: string
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
  // WXT Storage key for tab history
  TAB_HISTORY_KEY: 'local:tab_history',

  // Tab age marking thresholds — all presets with labels, days, and color names.
  THRESHOLDS: {
    /** How many threshold levels are active and editable (from youngest).
     *  Can be set from 1 to the total number of presets. Default is 3. */
    activeLevels: 3,

    // First activeLevels items (from start) are used as active thresholds.
    // Colors reference THEME_COLORS mapping (color names):
    // - Chrome/Firefox tab groups API uses color names directly
    // - CSS styling uses THEME_COLORS[colorName] to get hex values
    presets: [
      { key: 'WEEK',               label: 'Week+',         days: 7,    color: 'green' },
      { key: 'WEEKS_2',               label: '2 Weeks+',       days: 14,   color: 'blue' },
      { key: 'MONTH',            label: 'Month+',        days: 28,   color: 'orange' },
      { key: 'QUARTERS',              label: 'Quarter+',      days: 90,   color: 'red' },
      { key: 'YEARS',           label: 'Are You kidding me ?',         days: 365,   color: 'pink' },
    ] as const satisfies readonly ThresholdLevel[],
  },
}

// Background service worker message action constants
// Imported by: background.ts (action handlers), UI components, and E2E tests
export const BACKGROUND_MESSAGE_ACTIONS = {
  GROUP_TABS_BY_AGE: 'groupTabsByAge',
  GROUP_TABS_BY_DOMAIN: 'groupTabsByDomain',
  UNGROUP_ALL_TABS: 'ungroupAllTabs',
  CREATE_MOCK_TABS: 'createMockTabs',
  GET_TABS: 'getTabs',
  ON_TAB_ACTIVATED: 'onTabActivated',
  HAS_PLUGIN_GROUPS: 'hasPluginGroups',
  CLOSE_TAB: 'closeTab',
} as const

