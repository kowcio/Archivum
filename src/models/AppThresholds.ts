import {APP_DEFAULTS, type ThresholdLevel} from '@/constants'

/**
 * Age threshold configuration with dynamic active levels.
 * Stores all threshold levels + activeLevels count to determine how many are enabled.
 * Invariant: 0 ≤ level[0] < level[1] < level[2] < ... < level[N-1]
 * Invariant: 1 ≤ activeLevels ≤ levels.length
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
    this.activeLevels = Math.max(1, Math.min(activeLevels, levels.length))
  }

  /**
   * Returns only the active threshold levels (first N based on activeLevels count).
   * Always safe: levels is always an array and activeLevels ≥ 1.
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
    * Validates that levels is an array; falls back to DEFAULT_THRESHOLDS if corrupted.
    * Handles WXT storage serialization edge cases (arrays as objects).
    */
   static fromObject(obj: {
     levels?: ThresholdLevel[] | Record<number, ThresholdLevel>
     activeLevels?: number
   }): AppThresholds {
     // Validate and convert levels to array
     let levels: ThresholdLevel[] | undefined = undefined

     if (Array.isArray(obj.levels)) {
       // Already an array
       levels = obj.levels
     } else if (obj.levels && typeof obj.levels === 'object') {
       // Object (from WXT storage serialization) — convert to array
       try {
         levels = Object.values(obj.levels).filter((item): item is ThresholdLevel =>
           item && typeof item === 'object' && 'days' in item
         )
       } catch {
         // Conversion failed
       }
     }

     if (!levels || levels.length === 0) {
       console.warn('[AppThresholds.fromObject] Invalid or missing levels, using defaults', {
         objKeys: Object.keys(obj),
         objType: typeof obj,
         levelsType: typeof obj.levels,
         isArray: Array.isArray(obj.levels),
         activeLevels: obj.activeLevels
       })
       return DEFAULT_THRESHOLDS
     }
    return new AppThresholds(
       levels,
       obj.activeLevels ?? APP_DEFAULTS.THRESHOLDS.activeLevels
     )
   }
}

/**
 * Default threshold values from APP_DEFAULTS configuration.
 * Used as fallback when storage is empty or corrupted.
 */
export const DEFAULT_THRESHOLDS = new AppThresholds(
   [...APP_DEFAULTS.THRESHOLDS.presets],
   APP_DEFAULTS.THRESHOLDS.activeLevels
 )

