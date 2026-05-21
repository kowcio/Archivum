/**
 * 🔄 Tab Update Service
 *
 * Runs daily to:
 * - Reload tabs via TabStore.getAllOpenedTabs()
 * - Wait for favicons via TabStore's internal logic
 * - Automatically mark old tabs via TabStore.markOldTabs()
 * - Keep Pinia store synchronized with browser reality
 *
 * Simple wrapper around TabStore methods.
 */
import { useTabStore } from '@/stores/TabStore'

export class TabUpdateService {
    /** Track active interval to prevent duplicates */
    private static activeInterval: NodeJS.Timeout | null = null

    /**
     * 🎯 Start the daily update timer
     * Runs immediately on startup, then every 24 hours.
     *
     * Delegates to TabStore for all heavy lifting:
     * - TabStore.getAllOpenedTabs() - loads tabs + waits for favicons
     * - TabStore.markOldTabs() - analyzes and marks old tabs with L-brackets
     *
     * @param intervalMs Milliseconds between runs (default: 24 hours)
     */
    static startDailyUpdate(intervalMs: number = 24 * 60 * 60 * 1000): void {
        console.log(`[TabUpdateService] ✅ Starting daily update (interval=${intervalMs}ms)`)

        // Run immediately on startup
        this.runUpdateCycle()

        // Then run on schedule
        if (this.activeInterval) {
            clearInterval(this.activeInterval)
        }

        this.activeInterval = setInterval(() => {
            this.runUpdateCycle()
        }, intervalMs)
    }

    /**
     * 🔄 Single update cycle: delegates to TabStore
     *
     * Uses Pinia store methods:
     * 1. TabStore.getAllOpenedTabs() - fetches tabs + waits for favicons
     * 2. TabStore.markOldTabs() - analyzes age + marks with L-brackets
     */
    private static async runUpdateCycle(): Promise<void> {
        const cycleId = Math.random().toString(36).slice(2, 9)
        const startTime = Date.now()

        console.log(`[TabUpdateService] 🔄 Cycle#${cycleId} started`)

        try {
            const tabStore = useTabStore()

            // 1️⃣ Load tabs + wait for favicons (all handled by getAllOpenedTabs)
            await tabStore.getAllOpenedTabs()

            // 2️⃣ Analyze age + mark old tabs (all handled by markOldTabs)
            await tabStore.markOldTabs()

            const elapsed = Date.now() - startTime
            console.log(
                `[TabUpdateService] ✅ Cycle#${cycleId} complete (${tabStore.tabs.length} tabs, ${elapsed}ms)`,
            )
        } catch (err) {
            const elapsed = Date.now() - startTime
            console.error(
                `[TabUpdateService] ❌ Cycle#${cycleId} failed (${elapsed}ms):`,
                err instanceof Error ? err.message : err,
            )
        }
    }
}

