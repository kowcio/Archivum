import { APP_DEFAULTS } from '@/constants'

/**
 * Age threshold configuration with validation and boundary helpers.
 * Invariant: 0 ≤ young < middle < old
 *
 * @example
 * const thresholds = new AppThresholds(7, 14, 21)
 * thresholds.isValid()        // true
 * thresholds.toBoundaries()   // [7, 14, 21]
 * thresholds.toJSON()         // { young: 7, middle: 14, old: 21 }
 */
export class AppThresholds {
  readonly young: number   // 0..young → 🟢 fresh
  readonly middle: number  // young..middle → 🟡 yellow
  readonly old: number     // middle..old → 🟠 orange, >old → 🔴 red

  constructor(young: number, middle: number, old: number) {
    this.young = young
    this.middle = middle
    this.old = old
  }

  /**
   * Returns boundaries as tuple [young, middle, old] for compatibility
   * with code that expects arrays (e.g., findIndex).
   */
  toBoundaries(): readonly [number, number, number] {
    return [this.young, this.middle, this.old]
  }

  /**
   * Validates strict ordering: 0 ≤ young < middle < old
   */
  isValid(): boolean {
    return this.young >= 0 && this.middle > this.young && this.old > this.middle
  }

  /**
   * Creates a new AppThresholds with partial updates.
   * Returns a new instance with merged values.
   */
  merge(partial: Partial<AppThresholds>): AppThresholds {
    return new AppThresholds(
      partial.young ?? this.young,
      partial.middle ?? this.middle,
      partial.old ?? this.old,
    )
  }

  /**
   * Serializes to plain object for storage/JSON.
   */
  toJSON(): { young: number; middle: number; old: number } {
    return { young: this.young, middle: this.middle, old: this.old }
  }

  /**
   * Creates AppThresholds from plain object (e.g., loaded from storage).
   */
  static fromObject(obj: { young: number; middle: number; old: number }): AppThresholds {
    return new AppThresholds(obj.young, obj.middle, obj.old)
  }
}

/**
 * Default threshold values from APP_DEFAULTS.
 * Used as fallback when storage is empty or corrupted.
 */
export const DEFAULT_THRESHOLDS = new AppThresholds(
  APP_DEFAULTS.THRESHOLDS.YOUNG,
  APP_DEFAULTS.THRESHOLDS.MIDDLE,
  APP_DEFAULTS.THRESHOLDS.OLD,
)

