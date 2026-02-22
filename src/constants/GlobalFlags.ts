/**
 * Simple configuration class with default values
 * This class provides centralized access to application configuration
 */
export class AppConfig {
    // Default configuration values
    static readonly DEFAULT_TABS_MARKING_AGE = 7
    static readonly DEFAULT_MIN_TABS_MARKING_AGE = 0
    static readonly DEFAULT_MAX_TABS_MARKING_AGE = 365
    static readonly STORAGE_KEY = 'global_store'
    static readonly APP_NAME = 'czynsz_ff'
}
