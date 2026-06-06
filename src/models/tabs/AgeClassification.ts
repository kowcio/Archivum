import type { AppThresholds } from '@/models/AppThresholds'

/**
 * Tab age state marker with simplified color handling.
 * Uses hex colors from threshold configuration for display styling.
 *
 * ⚡ Properties: color (hex), label, inlineStyle
 * ⚡ Getters: isFresh, shouldMark
 *
 * @example
 * const c = AgeClassification.fromDays(10, thresholds)
 * c.index          // 0=Fresh, 1+=Level
 * c.color          // Hex color from threshold preset
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

    /** Hex color derived from threshold preset */
    get color(): string {
        if (this.index === 0) return '#00e676' // Fresh green
        const activeList = this.thresholds.active()
        const level = activeList[this.index - 1]
        return level?.color ?? '#777777'
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

