import { ThemeColor, THEME_COLOR_HEX } from '@/constants.ts'
import type { AppThresholds } from '@/models/AppThresholds.ts'

/**
 * Tab age state marker. Uses ThemeColor enum values directly as CSS color names.
 *
 * ⚡ Properties: colorName, label, inlineStyle
 * ⚡ Getters: isFresh, shouldMark
 *
 * @example
 * const c = AgeClassification.fromDays(10, thresholds)
 * c.index        // 0=Fresh, 1+=Level
 * c.colorName    // ThemeColor.Green
 * c.label        // "Week+"
 * c.inlineStyle  // { backgroundColor: "green" }
 */
export class AgeClassification {
    readonly index: number
    private thresholds: AppThresholds

    constructor(index: number, thresholds: AppThresholds) {
        this.thresholds = thresholds
        this.index = Math.max(0, Math.min(thresholds.active().length, index))
    }

    /** Color name from THRESHOLD preset — used directly as CSS value */
    get colorName(): string {
        if (this.index === 0) return ""
        const activeList = this.thresholds.active()
        const level = activeList[this.index - 1]
        return (level?.color as string) ?? ThemeColor.Grey
    }

    /** Label from threshold level */
    get label(): string {
        if (this.index === 0) return 'Fresh'
        const activeList = this.thresholds.active()
        const level = activeList[this.index - 1]
        return level?.label ?? 'Unknown'
    }

    /** Inline style: readable background color from brand palette */
    get inlineStyle(): Record<string, string> {
        const hex = THEME_COLOR_HEX[this.colorName]
        if (!hex) return {}
        // Convert hex to rgba with 30% opacity for faded look
        const rgba = this.hexToRgba(hex, 0.3)
        return {
            backgroundColor: rgba,
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '4px',
            textAlign: 'center',
            minWidth: '40px',
        }
    }

    /** Helper: Convert hex color to rgba with alpha */
    private hexToRgba(hex: string, alpha: number): string {
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }

    get isFresh(): boolean  { return this.index === 0 }

    static fromDays(days: number, thresholds: AppThresholds): AgeClassification {
        const boundaries = thresholds.toBoundaries()
        const found = boundaries.findIndex((threshold) => days <= threshold)
        const indexInThresholds = found !== -1 ? found : thresholds.active().length
        return new AgeClassification(indexInThresholds, thresholds)
    }
}
