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
        return { backgroundColor: hex }
    }

    get isFresh(): boolean  { return this.index === 0 }

    static fromDays(days: number, thresholds: AppThresholds): AgeClassification {
        const boundaries = thresholds.toBoundaries()
        const found = boundaries.findIndex((threshold) => days <= threshold)
        const indexInThresholds = found !== -1 ? found : thresholds.active().length
        return new AgeClassification(indexInThresholds, thresholds)
    }
}
