import { ThemeColor } from '@/constants.ts'
import type { AppThresholds } from '@/models/AppThresholds.ts'

/**
 * Hex color lookup for ThemeColor enum values.
 * Used by AgeClassification to produce inline CSS styles.
 */
const THEME_COLOR_HEX: Record<ThemeColor, string> = {
  [ThemeColor.Green]:  '#188038',
  [ThemeColor.Blue]:   '#1f73e7',
  [ThemeColor.Yellow]: '#f9ab00',
  [ThemeColor.Orange]: '#ffa500',
  [ThemeColor.Red]:    '#d33b27',
  [ThemeColor.Pink]:   '#e91e63',
  [ThemeColor.Purple]: '#7c3aed',
  [ThemeColor.Grey]:   '#9aa0a6',
  [ThemeColor.Cyan]:   '#00bcd4',
}

/**
 * Tab age state marker with unified color handling.
 * Uses color names from ThemeColor enum for both Chrome API and CSS styling.
 *
 * ⚡ Properties: colorName (string), color (hex), label, inlineStyle
 * ⚡ Getters: isFresh, shouldMark
 *
 * @example
 * const c = AgeClassification.fromDays(10, thresholds)
 * c.index          // 0=Fresh, 1+=Level
 * c.colorName      // Color name (e.g., 'green', 'blue')
 * c.color          // Hex color
 * c.label          // From threshold.label or "Fresh"
 * c.inlineStyle    // Direct backgroundColor + text color
 * c.shouldMark     // false for Fresh, true for others
 */
export class AgeClassification {
    readonly index: number
    private thresholds: AppThresholds

    constructor(index: number, thresholds: AppThresholds) {
        this.thresholds = thresholds
        this.index = Math.max(0, Math.min(thresholds.active().length, index))
    }

    /** Color name from THRESHOLD preset (e.g., ThemeColor.Green, ThemeColor.Blue) */
    get colorName(): ThemeColor {
        if (this.index === 0) return ThemeColor.Green // Fresh
        const activeList = this.thresholds.active()
        const level = activeList[this.index - 1]
        return (level?.color as ThemeColor) ?? ThemeColor.Grey
    }

    /** Hex color derived from ThemeColor enum mapping */
    get color(): string {
        return THEME_COLOR_HEX[this.colorName] ?? '#777777'
    }

    /** Label from threshold level */
    get label(): string {
        if (this.index === 0) return 'Fresh'
        const activeList = this.thresholds.active()
        const level = activeList[this.index - 1]
        return level?.label ?? 'Unknown'
    }

    /** Inline style with backgroundColor and contrast text color */
    get inlineStyle(): Record<string, string> {
        return {
            backgroundColor: this.color,
            color: this.getTextColor(),
        }
    }

    private getTextColor(): string {
        // Calculate brightness to determine if dark or light text is needed
        const rgb = parseInt(this.color.replace('#', ''), 16)
        const r = (rgb >> 16) & 255
        const g = (rgb >> 8) & 255
        const b = rgb & 255
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        return brightness > 155 ? '#000000' : '#ffffff'
    }

    get isFresh(): boolean  { return this.index === 0 }

    static fromDays(days: number, thresholds: AppThresholds): AgeClassification {
        const boundaries = thresholds.toBoundaries()
        const found = boundaries.findIndex((threshold) => days <= threshold)
        const indexInThresholds = found !== -1 ? found : thresholds.active().length
        return new AgeClassification(indexInThresholds, thresholds)
    }
}

