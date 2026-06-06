// ─── App-wide constants ───────────────────────────────────────────────────────
import packageJson from "../package.json";
import dayjs from "dayjs";

/** Single threshold level configuration: key + label + days + hex color. */
export type ThresholdLevel = {
  key: string
  label: string
  days: number
  /** Hex color value */
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
  // Tab age marking thresholds — all presets with labels, days, and hex colors.
  THRESHOLDS: {
    /** How many threshold levels are active and editable (from youngest).
     *  Must be >= 3. If you set it to 4, the 4th threshold will also be editable. */
    activeLevels: 3,

    // First activeLevels items (from start) are used as active thresholds.
    // Colors are hex values compatible with Chrome and Firefox tab group colors
    presets: [
      { key: 'WEEK',               label: 'Week',      days: 7,   color: '#1f73e7' },    // blue
      { key: 'WEEKS_2',            label: '2 Week',   days: 14,   color: '#f9ab00' },    // yellow
      { key: 'MONTH',              label: 'Month',     days: 30,   color: '#d33b27' },    // red
      { key: 'QUARTERS',           label: 'Quarter',  days: 90,   color: '#e91e63' },    // pink
      { key: 'YEARS',              label: 'Year',      days: 365,  color: '#7c3aed' },    // purple
      { key: 'ANCIENT', label: 'Are You kidding me ?',  days: 3650, color: '#9aa0a6' },  // grey
    ] as const satisfies readonly ThresholdLevel[],
  },
}

