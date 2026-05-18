import type {Tabs} from 'webextension-polyfill';
import dayjs from 'dayjs';

/**
 * Model representing a tab row in the table
 * All calculated fields are derived in the constructor
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

  constructor(tab: Tabs.Tab) {
    // Basic fields
    this.id = tab.id ?? null;
    this.openerTabId = tab.openerTabId ?? null;
    this.rowKey = String(tab.id ?? tab.sessionId ?? tab.url ?? `row-${Math.random().toString(36).slice(2)}`);
    this.thumbnail = tab.favIconUrl ?? '';

    // Derived fields - domain extraction
    this.domain = this.extractDomain(tab.url);

    // Derived fields - text truncation
    this.title = this.removeAllAfterLastDash(tab.title ? tab.title : 'Missing title');
    // this.url = this.truncateText(tab.url);
    this.url = tab.url ? tab.url : 'Missing url';

    // Derived fields - last access calculations
    // Use dayjs to compute days and hours since last access. Keep numeric values with two decimal places.
    this.lastAccess = tab.lastAccessed;

    if (tab.lastAccessed) {
      const now = dayjs();
      const last = dayjs(tab.lastAccessed);
      this.lastAccessDays = now.diff(last, 'day' );
      this.lastAccessHours = now.diff(last, 'hour');
    } else {
      this.lastAccessDays = 0;
      this.lastAccessHours = 0;
    }
    this.lastAccessClass = this.getAgeBgClass(this.lastAccessDays ?? 0);

    // Add dot to title based on age classification
    this.title = this.addDotToTitle(this.title, this.lastAccessDays ?? 0);
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
   * Truncates text to 100 characters, splitting by "|" first so we get only the relevant title
   */
  private truncateText(text: string | undefined): string {
    if (!text) return '';
    const firstPart = text.split('|')[0];
    return firstPart.length > 100 ? firstPart.substring(0, 100) + '...' : firstPart;
  }

  /**
   * Gets the Quasar background color class based on age in days
   * - 0-7 days: bg-green-3 (pastel green)
   * - 8-14 days: bg-yellow-3 (pastel yellow)
   * - 15-28 days: bg-orange-3 (pastel orange)
   * - 29+ days: bg-red-3 (pastel red)
   */
  private getAgeBgClass(days: number): string {
    if (!Number.isFinite(days) || days === Infinity) return 'bg-negative-3';
    if (days <= 7) return 'bg-green-3';
    if (days <= 14) return 'bg-yellow-3';
    if (days <= 21) return 'bg-orange-3';
    return 'bg-red-3';
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
   * Adds a colored dot to the title based on age in days
   */
  private addDotToTitle(title: string, days: number): string {
    if (!Number.isFinite(days)) return title;

    let dot = '';
    // if (days <= 7) dot = '🟢';
    if (days <= 7) dot = '';
    else if (days <= 14) dot = '🟡';
    else if (days <= 21) dot = '🟠';
    else dot = '🔴';

    return `${dot} ${title}`;
  }

  /**
   * Static factory method to create multiple TabRows from array of Tabs.Tab
   */
  static fromTabs(tabs: Tabs.Tab[]): TabRow[] {
    if (!Array.isArray(tabs)) return []
    return tabs.map((tab) => new TabRow(tab));
  }
}
