// ─── App-wide constants ───────────────────────────────────────────────────────
import packageJson from "../package.json";
import dayjs from "dayjs";

/** Type definition for app global values (from former globals.ts) */
export type GlobalValues = {
  APP_VERSION: string
}

/** Single place to change any app-wide constant. Replaces AppConfig + globals.ts. */
export const APP_CONSTANTS = {
  APP_NAME: 'Tab Age Tracker',
  APP_ID: 'TabAgeTracker',
  STORAGE_KEY: 'global_store',
  STORE_TAB_STORE: 'tab_store',
  APP_VERSION: `${packageJson.version}-${dayjs().format('YYYYMMDD-HH:mm')}`,
} as const

/** Named export for direct APP_VERSION access (replaces globals.ts export) */
export const APP_VERSION = APP_CONSTANTS.APP_VERSION

export const APP_DEFAULTS = {
  // Tab age marking thresholds (in days)
  THRESHOLDS: {
    YOUNG: 7,
    MIDDLE: 14,
    OLD: 21,
  },
  ALARM_UPDATE_TABS: 'update-tabs-interval',
  MIN_MARKING_AGE: 0,
  MAX_MARKING_AGE: 365,

  TAB_HISTORY_KEY: 'tab_history' as const,

  AGE_COLOR_LIST : {
    AGE_COLOR_FRESH:  '#00e676' as const,  // neon green
    AGE_COLOR_YOUNG:  '#ffd740' as const,  // saturated yellow
    AGE_COLOR_MIDDLE: '#ff6d00' as const,  // deep orange
    AGE_COLOR_OLD:    '#ff1744' as const,  // alarm red
  }
  /** Age classification colours — single source of truth.
   *  Order [0..3] maps to: fresh → young → middle → old */
}
