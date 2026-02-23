// ─── App-wide constants ───────────────────────────────────────────────────────
import packageJson from "../package.json";
import dayjs from "dayjs";

/** Single place to change any app-wide constant. Replaces AppConfig + globals.ts. */
export const APP_CONSTANTS = {
  APP_NAME: 'czynsz_ff',
  STORAGE_KEY: 'global_store',
  APP_VERSION: `${packageJson.version}-${dayjs().format('YYYYMMDD-HH:mm')}`,
  DEFAULT_TABS_MARKING_AGE: 7,
} as const
