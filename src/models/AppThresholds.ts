import { APP_DEFAULTS, type ThresholdLevel } from '@/constants'

/**
 * Age threshold configuration with dynamic active levels.
 * Stores all threshold levels + activeLevels count to determine how many are enabled.
 * Invariant: 0 ≤ level[0] < level[1] < level[2] < ... < level[N-1]
 * Invariant: 3 ≤ activeLevels ≤ levels.length
 *
 * @example
 * const thresholds = new AppThresholds(
 *   [
 *     { key: 'DAYS', label: 'Days', days: 7, color: '#ffd740' },
 *     { key: 'WEEK', label: 'Week', days: 14, color: '#ff6d00' },
 *     { key: 'WEEKS_2', label: '2 Weeks', days: 21, color: '#ff1744' }
 *   ],
 *   3  // activeLevels: use first 3
 * )
 * thresholds.levels               // all levels
 * thresholds.active()             // first 3 levels (active)
 * thresholds.isValid()            // true
 * thresholds.toBoundaries()       // [7, 14, 21]
 */
export class AppThresholds {
  readonly levels: ThresholdLevel[]
  readonly activeLevels: number

  constructor(levels: ThresholdLevel[], activeLevels: number = levels.length) {
    this.levels = levels
    // Clamp activeLevels to valid range
    this.activeLevels = Math.max(3, Math.min(activeLevels, levels.length))
  }

  /**
   * Returns only the active threshold levels (first N based on activeLevels count).
   */
  active(): ThresholdLevel[] {
    return this.levels.slice(0, this.activeLevels)
  }

  /**
   * Returns boundaries as array of days for active thresholds.
   * Example: [7, 14, 21] means: 0-7=level0, 7-14=level1, 14-21=level2
   */
  toBoundaries(): readonly number[] {
    return this.active().map(l => l.days)
  }

  /**
   * Validates strict ordering for active levels: 0 ≤ level[0] < level[1] < ... < level[N-1]
   */
  isValid(): boolean {
    const active = this.active()
    if (active.length < 1) return false
    if (active[0].days < 0) return false
    for (let i = 1; i < active.length; i++) {
      if (active[i].days <= active[i - 1].days) return false
    }
    return true
  }

  /**
   * Creates a new AppThresholds with partial updates by index (only active levels).
   * Returns a new instance with merged values.
   * @example merge({ 0: { days: 5 } }) — update first active level only
   */
  merge(partial: Partial<Record<number | string, Partial<ThresholdLevel>>>): AppThresholds {
    const mergeLevel = (current: ThresholdLevel, patch?: Partial<ThresholdLevel>): ThresholdLevel => ({
      key: patch?.key ?? current.key,
      label: patch?.label ?? current.label,
      days: patch?.days ?? current.days,
      color: patch?.color ?? current.color,
    })

    const updated = this.levels.map((level, idx) => {
      const patchByIndex = partial[idx] as Partial<ThresholdLevel> | undefined
      return mergeLevel(level, patchByIndex)
    })

    return new AppThresholds(updated, this.activeLevels)
  }

  /**
   * Creates a new instance with updated activeLevels count.
   */
  withActiveLevels(count: number): AppThresholds {
    return new AppThresholds(this.levels, count)
  }

  /**
   * Serializes to plain object for storage/JSON.
   */
  toJSON(): { levels: ThresholdLevel[]; activeLevels: number } {
    return { levels: this.levels, activeLevels: this.activeLevels }
  }

  /**
   * Creates AppThresholds from plain object (e.g., loaded from storage).
   */
  static fromObject(obj: {
    levels?: ThresholdLevel[]
    activeLevels?: number
  }): AppThresholds {
    return new AppThresholds(
      obj.levels ?? DEFAULT_THRESHOLDS.levels,
      obj.activeLevels ?? APP_DEFAULTS.THRESHOLDS_LEVELS
    )
  }
}

/**
 * Default threshold values from APP_DEFAULTS configuration.
 * Used as fallback when storage is empty or corrupted.
 */
export const DEFAULT_THRESHOLDS = new AppThresholds(
  APP_DEFAULTS.THRESHOLDS.presets as ThresholdLevel[],
  APP_DEFAULTS.THRESHOLDS_LEVELS
)

