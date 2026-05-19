/**
 * Centralised helper for tab age classification and favicon L-bracket marking.
 * The L-bracket overlay on the favicon is the ONLY method used to mark tabs.
 */
import { APP_DEFAULTS } from '@/constants'

export interface AgeColorEntry {
    color: string
    cssClass: string
}

/** Chrome tab group color names mapped to each age classification index */
export const GROUP_COLOR_MAP = ['green', 'yellow', 'orange', 'red'] as const
export type TabGroupColor = typeof GROUP_COLOR_MAP[number]

/** All age classifications in ascending order of severity. */
export const DOT_COLOR_MAP: readonly AgeColorEntry[] = [
    { color: APP_DEFAULTS.AGE_COLOR_LIST.AGE_COLOR_FRESH, cssClass: 'bg-green-2 text-green-10'   },
    { color: APP_DEFAULTS.AGE_COLOR_LIST.AGE_COLOR_YOUNG, cssClass: 'bg-amber-2 text-amber-10'   },
    { color: APP_DEFAULTS.AGE_COLOR_LIST.AGE_COLOR_MIDDLE, cssClass: 'bg-orange-2 text-orange-10' },
    { color: APP_DEFAULTS.AGE_COLOR_LIST.AGE_COLOR_OLD, cssClass: 'bg-red-2 text-red-10'       },
] as const

export class TabDots {
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
     * ✅ CRITICAL — CONFIRMED WORKING (2026-05-19)
     *
     * Injected via executeScript — draws an L-shaped age indicator on the favicon:
     *  - Left edge  : solid colour bar (full height) — age colour (green/yellow/orange/red)
     *  - Bottom edge: solid colour bar (full width)  — age colour
     *  - FAVICON_MARGIN (2px) gap between the favicon image and both border edges
     *    so the icon stays readable and visually separated from the age indicator
     *
     * WHY L-SHAPE:
     *  - Less intrusive than full square border — favicon stays fully readable
     *  - Left bar = colour classification (green→red)
     *  - Bottom bar = horizontal age line (universal "underline" signal)
     *  - Together form a corner indicator — well-known pattern (IDE git markers)
     *
     * WHY PRE-FETCH IN EXTENSION CONTEXT:
     *  - faviconData is a data: URL fetched in extension context (see fetchFaviconDataUrl)
     *  - img.src = data: URL bypasses CORS entirely — no canvas taint, no SecurityError
     *
     * @param color        Hex colour (#00e676 / #ffd740 / #ff6d00 / #ff1744)
     * @param faviconData  data: URL pre-fetched in extension context (CORS-safe), or null
     */
    static get applyLBracketPageScript(): (color: string, faviconData: string | null) => void {
        return (color: string, faviconData: string | null): void => {
            const SIZE           = 32
            const BORDER         = 4.5
            const FAVICON_MARGIN = 2   // px gap between favicon and the L-border edges
            const MARKER         = 'data-ext-age-ring'
            const HIDDEN_ATTR    = 'data-ext-age-ring-hidden'

            const canvas = document.createElement('canvas')
            canvas.width  = SIZE
            canvas.height = SIZE
            const ctx = canvas.getContext('2d')!

            const win     = window as unknown as Record<string, unknown>
            const obsKey  = '__extAgeRingObs'
            const lockKey = '__extAgeRingLock'

            // CRITICAL FIX: Disconnect existing observer FIRST to prevent stacking
            // when markTabWithLBracket is called multiple times on the same tab
            const existingObs = win[obsKey] as MutationObserver | undefined
            if (existingObs) {
                existingObs.disconnect()
                delete win[obsKey]
            }

            function hideOriginalFavicons(): void {
                document.querySelectorAll('link[rel*="icon"]').forEach((el) => {
                    if (!el.hasAttribute(MARKER) && !el.hasAttribute(HIDDEN_ATTR)) {
                        el.setAttribute(HIDDEN_ATTR, 'true')
                        ;(el as HTMLLinkElement).rel = '__ext_hidden_icon'
                    }
                })
            }

            function applyFaviconLink(dataUrl: string): void {
                win[lockKey] = true
                document.querySelectorAll(`link[${MARKER}]`).forEach((el) => el.remove())
                hideOriginalFavicons()
                const link = document.createElement('link')
                link.rel  = 'icon'
                link.type = 'image/png'
                link.setAttribute(MARKER, 'true')
                link.href = dataUrl
                document.head.appendChild(link)
                win[lockKey] = false
                const obs = new MutationObserver(() => {
                    // Ignore if we're currently making changes
                    if (win[lockKey]) return

                    // Only re-inject if our link is truly missing from the DOM
                    const ourLink = document.querySelector(`link[${MARKER}]`)
                    if (!ourLink) {
                        // Double-check it's not a timing issue - wait one tick
                        setTimeout(() => {
                            if (document.querySelector(`link[${MARKER}]`)) return
                            win[lockKey] = true
                            hideOriginalFavicons()
                            const relink = document.createElement('link')
                            relink.rel  = 'icon'
                            relink.type = 'image/png'
                            relink.setAttribute(MARKER, 'true')
                            relink.href = dataUrl
                            document.head.appendChild(relink)
                            win[lockKey] = false
                        }, 0)
                    }
                })
                obs.observe(document.head, { childList: true, subtree: true })
                win[obsKey] = obs
            }

            function drawLBracket(): void {
                ctx.strokeStyle = color
                ctx.lineWidth   = BORDER
                ctx.lineCap     = 'square'
                ctx.beginPath()
                ctx.moveTo(BORDER / 2, 0)
                ctx.lineTo(BORDER / 2, SIZE)        // left vertical
                ctx.moveTo(0, SIZE - BORDER / 2)
                ctx.lineTo(SIZE, SIZE - BORDER / 2) // bottom horizontal
                ctx.stroke()
            }

            ctx.clearRect(0, 0, SIZE, SIZE)

            if (faviconData) {
                const img = new Image()
                img.onload = () => {
                    ctx.drawImage(
                        img,
                        BORDER + FAVICON_MARGIN,
                        0,
                        SIZE - BORDER - FAVICON_MARGIN,
                        SIZE - BORDER - FAVICON_MARGIN,
                    )
                    drawLBracket()
                    applyFaviconLink(canvas.toDataURL('image/png'))
                }
                img.onerror = () => {
                    drawLBracket()
                    applyFaviconLink(canvas.toDataURL('image/png'))
                }
                img.src = faviconData
            } else {
                drawLBracket()
                applyFaviconLink(canvas.toDataURL('image/png'))
            }
        }
    }

    /** Injected via executeScript — removes the L-bracket overlay and restores original favicons. */
    static get removeLBracketPageScript(): () => void {
        return () => {
            const win = window as unknown as Record<string, unknown>
            const obs = win['__extAgeRingObs'] as MutationObserver | undefined
            if (obs) { obs.disconnect(); delete win['__extAgeRingObs'] }
            document.querySelectorAll('link[data-ext-age-ring]').forEach((el) => el.remove())
            document.querySelectorAll('link[data-ext-age-ring-hidden]').forEach((el) => {
                el.removeAttribute('data-ext-age-ring-hidden')
                ;(el as HTMLLinkElement).rel = 'icon'
            })
        }
    }
}

