import { APP_DEFAULTS } from '@/constants'

/** Colors indexed by AgeClassification.index — sourced directly from APP_DEFAULTS */
const AGE_COLORS = [
    APP_DEFAULTS.AGE_COLOR_LIST.AGE_COLOR_FRESH,
    APP_DEFAULTS.AGE_COLOR_LIST.AGE_COLOR_YOUNG,
    APP_DEFAULTS.AGE_COLOR_LIST.AGE_COLOR_MIDDLE,
    APP_DEFAULTS.AGE_COLOR_LIST.AGE_COLOR_OLD,
] as const

/** Quasar row classes indexed by AgeClassification.index */
const AGE_CSS_CLASSES = [
    'bg-green-2 text-green-10',
    'bg-amber-2 text-amber-10',
    'bg-orange-2 text-orange-10',
    'bg-red-2 text-red-10',
] as const

/**
 * Tab age state marker. Stores only the index — color and cssClass are
 * computed from APP_DEFAULTS so there is no duplication.
 *
 * ⚡ Use the getter properties: classification.color, classification.cssClass
 * ⚡ Use the boolean getters: classification.isFresh, classification.shouldMark
 *
 * @example
 * const classification = AgeClassification.fromDays(days, boundaries)
 * classification.index        // 0=Fresh 1=Young 2=Middle 3=Old
 * classification.color        // '#00e676' (from APP_DEFAULTS)
 * classification.shouldMark   // false for Fresh, true for all others
 */
export class AgeClassification {
    /** 0=Fresh  1=Young  2=Middle  3=Old */
    readonly index: number

    constructor(index: number) {
        this.index = Math.max(0, Math.min(3, index))
    }

    /** Hex color from APP_DEFAULTS.AGE_COLOR_LIST */
    get color(): string { return AGE_COLORS[this.index] }

    /** Quasar CSS class for table row background */
    get cssClass(): string { return AGE_CSS_CLASSES[this.index] }

    get isFresh(): boolean  { return this.index === 0 }
    get isYoung(): boolean  { return this.index === 1 }
    get isMiddle(): boolean { return this.index === 2 }
    get isOld(): boolean    { return this.index === 3 }

    /** True when the tab should receive an L-bracket overlay (not Fresh) */
    get shouldMark(): boolean { return this.index >= 1 }

    /**
     * Factory: compute state from days + boundaries tuple.
     * @param days - days since last access (use TabRow.lastAccessDays)
     * @param boundaries - [young, middle, old] threshold days
     */
    static fromDays(days: number, boundaries: readonly [number, number, number]): AgeClassification {
        const found = boundaries.findIndex((threshold) => days <= threshold)
        return new AgeClassification(found !== -1 ? found : 3)
    }
}
