import dayjs from 'dayjs';
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds.ts'

/**
 * Model representing a tab row in the table
 * All calculated fields are derived in the constructor.
 * Note: Uses active thresholds (only the first N levels enabled by THRESHOLDS.activeLevels).
 *
 * 🧪 DEV: Pass currentTime parameter to use fake/warped time for testing.
 */
export class TabRow {
  readonly ordinal?: number;
  readonly rowKey: string;
  readonly thumbnail: string;
  readonly domain: string;
  readonly title: string;
  readonly url: string;
  readonly id: number | null;
  readonly openerTabId: number | null;
  readonly lastAccess: number | undefined;
  readonly lastAccessDays: number | undefined;
  readonly lastAccessHours: number | undefined;
  readonly lastAccessClass: string;

  /**
   * @param tab - Browser tab object
   * @param thresholds - Age threshold configuration
   * @param currentTime - 🧪 DEV-ONLY: Override current time for testing (defaults to Date.now())
   */
  constructor(tab: any, thresholds: AppThresholds = DEFAULT_THRESHOLDS, currentTime?: number) {
    // Basic fields
    this.id = tab.id ?? null;
    this.openerTabId = tab.openerTabId ?? null;
    this.rowKey = String(tab.id ?? tab.sessionId ?? tab.url ?? `row-${Math.random().toString(36).slice(2)}`);
    // Use favicon URL from tab
    this.thumbnail = tab.favIconUrl ?? ''

    // Derived fields - domain extraction
    this.domain = this.extractDomain(tab.url);

    // Derived fields - text truncation
    this.title = this.removeAllAfterLastDash(tab.title ? tab.title : 'Missing title');
    // this.url = this.truncateText(tab.url);
    this.url = tab.url ? tab.url : 'Missing url';

     // Derived fields - last access calculations
     // Use dayjs to compute days and hours since last access. Keep numeric values with two decimal places.
     this.lastAccess = tab.lastAccessed;

     if (tab.lastAccessed && tab.lastAccessed > 0) {
       // ✅ Use fake time if provided (for testing), otherwise real time
       const now = dayjs(currentTime ?? Date.now());
       // Handle both milliseconds (large numbers) and seconds (small numbers)
       const lastTimestamp = tab.lastAccessed > 1e10 ? tab.lastAccessed : tab.lastAccessed * 1000;
       const last = dayjs(lastTimestamp);
       this.lastAccessDays = now.diff(last, 'day');
       this.lastAccessHours = now.diff(last, 'hour');
     } else {
       this.lastAccessDays = 0;
       this.lastAccessHours = 0;
     }
    this.lastAccessClass = this.getAgeBgClass(this.lastAccessDays ?? 0, thresholds);
  }

  /**
   * Extracts domain from URL
   */
  private extractDomain(url?: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch (err) {
      console.error('Failed to parse tab URL', err);
      return url;
    }
  }

    /**
     * Gets the Quasar background color class based on age in days.
     * Uses only the active thresholds (first N levels from THRESHOLDS.activeLevels).
     */
   private getAgeBgClass(days: number, thresholds: AppThresholds): string {
     if (!Number.isFinite(days) || days === Infinity) return 'bg-negative-3';

     // Determine age index based on active thresholds
     const boundaries = thresholds.toBoundaries()
     for (let i = 0; i < boundaries.length; i++) {
       if (days <= boundaries[i]) {
         return this.getBgClassForIndex(i)
       }
     }
     // Beyond the last threshold
     return this.getBgClassForIndex(boundaries.length)
   }

   private getBgClassForIndex(idx: number): string {
     const classes = [
       'bg-green-3',   // Fresh (before first)
       'bg-yellow-3',  // Level 0
       'bg-orange-3',  // Level 1
       'bg-red-3',     // Level 2+
       'bg-red-4',     // Level 3+
       'bg-red-5',     // Level 4+
     ]
     return classes[idx] ?? 'bg-red-5'
   }

  /**
   * Removes everything after the last dash in the text
   */
  private removeAllAfterLastDash(text: string): string {
    if (!text) return text
    const lastIndex = text.lastIndexOf('-')
    return lastIndex !== -1 ? text.slice(0, lastIndex).trim() : text
  }

  /**
   * Static factory method to create multiple TabRows from array of Tabs.Tab
   *
   * @param tabs - Array of browser tabs
   * @param thresholds - Age threshold configuration
   * @param currentTime - 🧪 DEV-ONLY: Override current time for all rows
   */
  static fromTabs(tabs: any, thresholds: AppThresholds = DEFAULT_THRESHOLDS, currentTime?: number): TabRow[] {
    if (!Array.isArray(tabs)) return []
    return tabs.map((tab) => new TabRow(tab, thresholds, currentTime))
  }
}
