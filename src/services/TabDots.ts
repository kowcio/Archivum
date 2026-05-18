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

/** Chrome tab group color names mapped to each age classification index */
export const GROUP_COLOR_MAP = ['green', 'yellow', 'orange', 'red'] as const
export type TabGroupColor = typeof GROUP_COLOR_MAP[number]

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

    /**
     * Injected via executeScript — draws a coloured ring around the existing favicon.
     * Works in Chrome and Firefox. Returns a Promise so executeScript awaits it.
     */
    static get applyFaviconOverlayPageScript(): (color: string) => Promise<void> {
        return (color: string): Promise<void> => new Promise((resolve) => {
            const SIZE   = 32
            const BORDER = 5
            const MARKER = 'data-ext-age-ring'

            const canvas = document.createElement('canvas')
            canvas.width  = SIZE
            canvas.height = SIZE
            const ctx = canvas.getContext('2d')!

            function applyFavicon(dataUrl: string): void {
                document.querySelectorAll(`link[${MARKER}]`).forEach((el) => el.remove())
                const link = document.createElement('link')
                link.rel  = 'icon'
                link.type = 'image/png'
                link.setAttribute(MARKER, 'true')
                link.href = dataUrl
                document.head.appendChild(link)
                resolve()
            }

            function drawWithFavicon(src: string): void {
                const img = new Image()
                img.crossOrigin = 'anonymous'
                img.onload = () => {
                    // Coloured ring background
                    ctx.fillStyle = color
                    ctx.beginPath()
                    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
                    ctx.fill()
                    // Original favicon clipped to inner circle
                    ctx.save()
                    ctx.beginPath()
                    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - BORDER, 0, Math.PI * 2)
                    ctx.clip()
                    ctx.drawImage(img, BORDER, BORDER, SIZE - BORDER * 2, SIZE - BORDER * 2)
                    ctx.restore()
                    applyFavicon(canvas.toDataURL('image/png'))
                }
                img.onerror = () => drawColoredCircle()
                img.src = src
            }

            function drawColoredCircle(): void {
                ctx.fillStyle = color
                ctx.beginPath()
                ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
                ctx.fill()
                applyFavicon(canvas.toDataURL('image/png'))
            }

            const existing = document.querySelector<HTMLLinkElement>('link[rel*="icon"]:not([data-ext-age-ring])')
            existing?.href ? drawWithFavicon(existing.href) : drawColoredCircle()
        })
    }

    /** Injected via executeScript — removes the age-ring favicon overlay. */
    static get removeFaviconOverlayPageScript(): () => void {
        return () => {
            document.querySelectorAll('link[data-ext-age-ring]').forEach((el) => el.remove())
        }
    }
}


