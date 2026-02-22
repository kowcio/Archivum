import dayjs from 'dayjs'
import packageJson from '../package.json' // adjust relative path as needed

// Centralized global/runtime values for app and tests
export interface GlobalValues {
  APP_VERSION: string
}

// Single source of truth for version value
const versionValue: string = `${packageJson.version}-${dayjs().format('YYYYMMDD-HH:mm')}`

// Named export for easy imports
export const APP_VERSION: string = versionValue

// Default export provides shape for other global values
const globals = {
  APP_VERSION: versionValue,
} as GlobalValues

export default globals
