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
     * ✅ CRUCIAL — CONFIRMED WORKING (2026-05-19)
     *
     * Fetches a favicon URL and converts it to a data URL.
     * Called from the EXTENSION context (store/options/background) which has
     * full cross-origin access via host_permissions — avoids CORS in content scripts.
     *
     * WHY THIS WORKS:
     *  - fetch() inside executeScript runs with the PAGE's origin → blocked by CORS.
     *  - fetch() here runs in the EXTENSION context with host_permissions: ['<all_urls>'] → allowed.
     *  - The resulting data: URL is passed as an argument to executeScript.
     *  - Inside the page script img.src = faviconData (data: URL) has zero CORS restrictions,
     *    so canvas.toDataURL() never throws a SecurityError (no canvas taint).
     */
    static async fetchFaviconDataUrl(url: string): Promise<string | null> {
        try {
            const resp = await fetch(url)
            const blob = await resp.blob()
            return await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload  = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(blob)
            })
        } catch {
            return null
        }
    }

    /**
     * ✅ CRUCIAL — CONFIRMED WORKING (2026-05-19)
     *
     * Injected via executeScript — draws a coloured ring around the existing favicon.
     * Receives the favicon as a pre-fetched data URL (fetched from extension context)
     * so no cross-origin fetch is needed inside the page, avoiding CORS issues.
     *
     * WHY THIS WORKS:
     *  - faviconData is a data: URL pre-fetched in extension context (see fetchFaviconDataUrl).
     *  - Setting img.src to a data: URL bypasses CORS entirely — no canvas taint.
     *  - Original favicon <link> elements are hidden (rel changed) so only our canvas ring shows.
     *  - A MutationObserver re-injects the ring if a SPA resets the favicon.
     *  - Ring-only mode (faviconData = null) still works for tabs with no favicon.
     *
     * @param color        Hex colour for the ring  (#66bb6a, #f2c037, …)
     * @param faviconData  data: URL of the favicon, or null for ring-only
     */
    static get applyFaviconOverlayPageScript(): (color: string, faviconData: string | null) => void {
        return (color: string, faviconData: string | null): void => {
            const SIZE        = 32
            const RING        = 3
            const INSET       = RING + 1
            const MARKER      = 'data-ext-age-ring'
            const HIDDEN_ATTR = 'data-ext-age-ring-hidden'

            const canvas = document.createElement('canvas')
            canvas.width  = SIZE
            canvas.height = SIZE
            const ctx = canvas.getContext('2d')!

            function hideOriginalFavicons(): void {
                document.querySelectorAll('link[rel*="icon"]').forEach((el) => {
                    if (!el.hasAttribute(MARKER)) {
                        el.setAttribute(HIDDEN_ATTR, 'true')
                        ;(el as HTMLLinkElement).rel = '__ext_hidden_icon'
                    }
                })
            }

            function applyFaviconLink(dataUrl: string): void {
                // Remove any previously injected ring links
                document.querySelectorAll(`link[${MARKER}]`).forEach((el) => el.remove())
                // Hide original favicon links so only ours shows
                hideOriginalFavicons()
                const link = document.createElement('link')
                link.rel  = 'icon'
                link.type = 'image/png'
                link.setAttribute(MARKER, 'true')
                link.href = dataUrl
                document.head.appendChild(link)

                // Watch for SPA favicon resets and re-inject our ring
                const obsKey = '__extAgeRingObs'
                const win = window as unknown as Record<string, unknown>
                if (!win[obsKey]) {
                    const obs = new MutationObserver(() => {
                        const stillHere = document.querySelector(`link[${MARKER}]`)
                        if (!stillHere) {
                            // Page reset its favicon — re-apply ours
                            hideOriginalFavicons()
                            const relink = document.createElement('link')
                            relink.rel  = 'icon'
                            relink.type = 'image/png'
                            relink.setAttribute(MARKER, 'true')
                            relink.href = dataUrl
                            document.head.appendChild(relink)
                        }
                    })
                    obs.observe(document.head, { childList: true, subtree: true })
                    win[obsKey] = obs
                }
            }

            function drawRing(): void {
                ctx.strokeStyle = color
                ctx.lineWidth   = RING
                ctx.beginPath()
                ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - RING / 2, 0, Math.PI * 2)
                ctx.stroke()
            }

            ctx.clearRect(0, 0, SIZE, SIZE)

            if (faviconData) {
                const img = new Image()
                img.onload = () => {
                    ctx.save()
                    ctx.beginPath()
                    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - INSET, 0, Math.PI * 2)
                    ctx.clip()
                    ctx.drawImage(img, INSET, INSET, SIZE - INSET * 2, SIZE - INSET * 2)
                    ctx.restore()
                    drawRing()
                    applyFaviconLink(canvas.toDataURL('image/png'))
                }
                img.onerror = () => {
                    drawRing()
                    applyFaviconLink(canvas.toDataURL('image/png'))
                }
                img.src = faviconData  // local data: URL — no CORS taint
            } else {
                drawRing()
                applyFaviconLink(canvas.toDataURL('image/png'))
            }
        }
    }

    /** Injected via executeScript — removes the age-ring favicon overlay. */
    static get removeFaviconOverlayPageScript(): () => void {
        return () => {
            // Disconnect SPA observer if present
            const win = window as unknown as Record<string, unknown>
            const obs = win['__extAgeRingObs'] as MutationObserver | undefined
            if (obs) { obs.disconnect(); delete win['__extAgeRingObs'] }
            document.querySelectorAll('link[data-ext-age-ring]').forEach((el) => el.remove())
            // Restore original favicon links
            document.querySelectorAll('link[data-ext-age-ring-hidden]').forEach((el) => {
                el.removeAttribute('data-ext-age-ring-hidden')
                ;(el as HTMLLinkElement).rel = 'icon'
            })
        }
    }
}


