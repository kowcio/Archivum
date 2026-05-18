/**
 * Centralised helper for tab age-dot colours and title-prefix manipulation.
 * Keeps all dot/colour constants in a single place to avoid duplication
 * across the store and scripting callbacks.
 */
export enum TabDot {
    Green  = '🟢',
    Yellow = '🟡',
    Orange = '🟠',
    Red    = '🔴',
    Bullet = '●',
    None   = '',
}

/** Pre-built regex that matches any age-dot prefix at the start of a string. */
export const DOT_PREFIX_PATTERN: RegExp = (() => {
    const dots = [TabDot.Green, TabDot.Yellow, TabDot.Orange, TabDot.Red, TabDot.Bullet]
    const escaped = dots.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    return new RegExp(`^(${escaped})\\s+`)
})()

export interface DotColorEntry {
    dot: TabDot
    color: string
    cssClass: string
}

/** All age classifications in ascending order of severity. */
export const DOT_COLOR_MAP: readonly DotColorEntry[] = [
    { dot: TabDot.Green,  color: '#66bb6a', cssClass: 'bg-green-2 text-green-10'   },
    { dot: TabDot.Yellow, color: '#f2c037', cssClass: 'bg-amber-2 text-amber-10'   },
    { dot: TabDot.Orange, color: '#fb8c00', cssClass: 'bg-orange-2 text-orange-10' },
    { dot: TabDot.Red,    color: '#e53935', cssClass: 'bg-red-2 text-red-10'       },
] as const

export class TabDots {
    /** Returns the dot emoji for a given CSS colour string. */
    static dotFromColor(color: string): TabDot {
        return DOT_COLOR_MAP.find((e) => e.color === color)?.dot ?? TabDot.Red
    }

    /** Returns the full classification entry for a given CSS colour string. */
    static entryFromColor(color: string): DotColorEntry {
        return DOT_COLOR_MAP.find((e) => e.color === color) ?? DOT_COLOR_MAP[3]
    }

    /**
     * Strips any leading age-dot prefix from a title string.
     * Safe to use both in Node/TS context and inside executeScript func strings.
     */
    static stripDotPrefix(title: string): string {
        return title.replace(DOT_PREFIX_PATTERN, '').trimStart()
    }

    /**
     * Emoji values derived from the enum that carry a visible glyph (excludes None/Bullet
     * which are not used as age prefixes but Bullet is still matched for cleanup).
     */
    static get dotValues(): TabDot[] {
        return [TabDot.Green, TabDot.Yellow, TabDot.Orange, TabDot.Red, TabDot.Bullet]
            .filter((d): d is TabDot => d !== TabDot.None)
    }

    /**
     * Injected via executeScript — strips dot prefix from `document.title`.
     * Receives the dots list as an argument so it stays self-contained.
     */
    static get removePrefixPageScript(): (dots: string[]) => void {
        return (dots: string[]) => {
            const escaped = dots.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
            document.title = document.title.replace(new RegExp(`^(${escaped})\\s+`), '').trimStart()
        }
    }

    /**
     * Injected via executeScript — prepends a prefix to `document.title`,
     * replacing any existing dot prefix first.
     * Receives the dots list as an argument so it stays self-contained.
     */
    static get applyPrefixPageScript(): (p: string, dots: string[]) => void {
        return (p: string, dots: string[]) => {
            const escaped = dots.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
            const dotPattern = new RegExp(`^(${escaped})\\s+`)
            const current = document.title.replace(dotPattern, '').trimStart()
            document.title = current.startsWith(p.trim())
                ? `${p}${current.replace(p.trim(), '').trimStart()}`
                : `${p}${current}`
        }
    }
}


