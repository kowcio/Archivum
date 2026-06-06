// ─── App-wide constants ───────────────────────────────────────────────────────
import packageJson from "../package.json";
import dayjs from "dayjs";

/** Single threshold level configuration: key + label + days + Chrome tab group color. */
export type ThresholdLevel = {
  key: string
  label: string
  days: number
  /** Chrome tab group color name or hex color */
  color: 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | string
}

/** Single place to change any app-wide constant. Replaces AppConfig + globals.ts. */
export const APP_CONSTANTS = {
  APP_NAME: 'Tab Age Tracker',
  APP_ID: 'TabAgeTracker',
  STORE_GLOBAL_STORE: 'global_store',
  STORE_TAB_STORE: 'tab_store',
  APP_VERSION: `${packageJson.version}-${dayjs().format('YYYYMMDD-HH:mm')}`,
} as const

/** Chrome tab group color to hex mapping */
export const TAB_GROUP_COLORS = {
  grey: '#9aa0a6',
  blue: '#1f73e7',
  red: '#d33b27',
  yellow: '#f9ab00',
  green: '#188038',
  pink: '#e91e63',
  purple: '#7c3aed',
  cyan: '#00bcd4',
} as const

export const APP_DEFAULTS = {
  /** How many threshold levels are active and editable (from youngest).
   *  Must be >= 3. If you set it to 4, the 4th threshold will also be editable. */
  THRESHOLDS_LEVELS: 3,

  // Tab age marking thresholds — all presets with labels, days, and Chrome tab group colors.
  // First THRESHOLDS_LEVELS items (from start) are used as active thresholds.
  // Colors are Chrome's predefined tab group colors: grey, blue, red, yellow, green, pink, purple, cyan
  THRESHOLDS: {
    presets: [
      { key: 'DAYS',               label: 'Days',      days: 7,    color: 'green' },
      { key: 'WEEK',               label: 'Week',      days: 14,   color: 'blue' },
      { key: 'WEEKS_2',            label: '2 Week',   days: 21,   color: 'yellow' },
      { key: 'MONTH',              label: 'Month',     days: 30,   color: 'red' },
      { key: 'QUARTERS',           label: 'Quarter',  days: 90,   color: 'pink' },
      { key: 'YEARS',              label: 'Year',      days: 365,  color: 'purple' },
      { key: 'ANCIENT', label: 'Are You kidding me ?',  days: 3650, color: 'grey' },
    ] as const satisfies readonly ThresholdLevel[],
  },
}

