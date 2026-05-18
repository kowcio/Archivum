// ─── App-wide constants ───────────────────────────────────────────────────────
import packageJson from "../package.json";
import dayjs from "dayjs";

/** Single place to change any app-wide constant. Replaces AppConfig + globals.ts. */
export const APP_CONSTANTS = {
  APP_NAME: 'czynsz_ff',
  STORAGE_KEY: 'global_store',
  APP_VERSION: `${packageJson.version}-${dayjs().format('YYYYMMDD-HH:mm')}`,

} as const

export const APP_DEFAULTS = {

  THRESHOLDS: {
    YOUNG: 7,
    MIDDLE:14,
    OLD:21,
  },



}
