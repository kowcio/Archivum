import dayjs from 'dayjs';

/**
 * Model representing a tab row in the table
 * All calculated fields are derived in the constructor.
 * Age → level classification lives in AgeClassification.fromDays() (single source of truth).
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

  /**
   * @param tab - Browser tab object
   * @param currentTime - 🧪 DEV-ONLY: Override current time for testing (defaults to Date.now())
   */
  constructor(tab: any, currentTime?: number) {
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
   * @param currentTime - 🧪 DEV-ONLY: Override current time for all rows
   */
  static fromTabs(tabs: any, currentTime?: number): TabRow[] {
    if (!Array.isArray(tabs)) return []
    return tabs.map((tab) => new TabRow(tab, currentTime))
  }
}
