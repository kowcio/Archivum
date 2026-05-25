/**
 * Centralised helper for favicon L-bracket marking.
 */

export class TabDots {
    /**
     * Fetches a favicon URL and converts it to a data URL.
     * Runs in EXTENSION context — has full cross-origin access via host_permissions.
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
     * Renders favicon + L-bracket in the EXTENSION context using OffscreenCanvas.
     * Returns a single data:URL used for BOTH:
     *  - ClassifiedTab.markedFaviconDataUrl  → shown in the table thumbnail
     *  - applyLBracketPageScript argument    → shown in the browser tab bar
     *
     * Single render = table and tab bar are always pixel-identical.
     * No canvas / no img.onload inside the page → eliminates async race conditions.
     */
    static async renderLBracketDataUrl(faviconDataUrl: string | null, color: string): Promise<string> {
        const SIZE           = 32
        const BORDER         = 4.5
        const FAVICON_MARGIN = 2

        const canvas = new OffscreenCanvas(SIZE, SIZE)
        const ctx    = canvas.getContext('2d')!

        ctx.clearRect(0, 0, SIZE, SIZE)

        if (faviconDataUrl) {
            try {
                const blob = await fetch(faviconDataUrl).then(r => r.blob())
                const img  = await createImageBitmap(blob)
                ctx.drawImage(
                    img,
                    BORDER + FAVICON_MARGIN,
                    0,
                    SIZE - BORDER - FAVICON_MARGIN,
                    SIZE - BORDER - FAVICON_MARGIN,
                )
            } catch {
                // favicon failed to decode — draw L-bracket only
            }
        }

        // L-bracket: left vertical bar + bottom horizontal bar
        ctx.strokeStyle = color
        ctx.lineWidth   = BORDER
        ctx.lineCap     = 'square'
        ctx.beginPath()
        ctx.moveTo(BORDER / 2, 0)
        ctx.lineTo(BORDER / 2, SIZE)
        ctx.moveTo(0, SIZE - BORDER / 2)
        ctx.lineTo(SIZE, SIZE - BORDER / 2)
        ctx.stroke()

        const resultBlob = await canvas.convertToBlob({ type: 'image/png' })
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload  = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(resultBlob)
        })
    }

    /**
     * Injected via executeScript — receives a PRE-RENDERED data URL (from renderLBracketDataUrl).
     * No canvas work in the page — only DOM manipulation to set the favicon link.
     * MutationObserver keeps the favicon alive on SPAs (React/Vue apps replace <link> on navigation).
     */
    static get applyLBracketPageScript(): (renderedDataUrl: string) => void {
        return (renderedDataUrl: string): void => {
            const win      = window as unknown as Record<string, unknown>
            const obsKey   = '__extAgeRingObs'
            const lockKey  = '__extAgeRingLock'
            const MARKER      = 'data-ext-age-ring'
            const HIDDEN_ATTR = 'data-ext-age-ring-hidden'

            // Disconnect previous observer (prevent stacking on re-mark)
            const existingObs = win[obsKey] as MutationObserver | undefined
            if (existingObs) { existingObs.disconnect(); delete win[obsKey] }

            function hideOriginalFavicons(): void {
                document.querySelectorAll('link[rel*="icon"]').forEach((el) => {
                    if (!el.hasAttribute(MARKER) && !el.hasAttribute(HIDDEN_ATTR)) {
                        el.setAttribute(HIDDEN_ATTR, 'true')
                        ;(el as HTMLLinkElement).rel = '__ext_hidden_icon'
                    }
                })
            }

            function injectFaviconLink(): void {
                win[lockKey] = true
                document.querySelectorAll(`link[${MARKER}]`).forEach(el => el.remove())
                hideOriginalFavicons()
                const link = document.createElement('link')
                link.rel   = 'icon'
                link.type  = 'image/png'
                link.setAttribute(MARKER, 'true')
                link.href  = renderedDataUrl
                document.head.appendChild(link)
                win[lockKey] = false
            }

            injectFaviconLink()

            // Keep our favicon alive — SPAs (YouTube, Reddit) may replace <head> links
            const obs = new MutationObserver(() => {
                if (win[lockKey]) return
                if (!document.querySelector(`link[${MARKER}]`)) {
                    setTimeout(() => {
                        if (!document.querySelector(`link[${MARKER}]`)) injectFaviconLink()
                    }, 0)
                }
            })
            obs.observe(document.head, { childList: true, subtree: true })
            win[obsKey] = obs
        }
    }

    /** Injected via executeScript — removes L-bracket and restores original favicons. */
    static get removeLBracketPageScript(): () => void {
        return () => {
            const win = window as unknown as Record<string, unknown>
            const obs = win['__extAgeRingObs'] as MutationObserver | undefined
            if (obs) { obs.disconnect(); delete win['__extAgeRingObs'] }
            document.querySelectorAll('link[data-ext-age-ring]').forEach(el => el.remove())
            document.querySelectorAll('link[data-ext-age-ring-hidden]').forEach(el => {
                el.removeAttribute('data-ext-age-ring-hidden')
                ;(el as HTMLLinkElement).rel = 'icon'
            })
        }
    }
}
