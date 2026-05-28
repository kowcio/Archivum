import type {Tabs} from 'webextension-polyfill';
import type { ClassifiedTab } from '@/models/tabs/ClassifiedTab'
import dayjs from 'dayjs';
import { AppThresholds, DEFAULT_THRESHOLDS } from '@/models/AppThresholds'

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

  constructor(tab: Tabs.Tab, thresholds: AppThresholds = DEFAULT_THRESHOLDS) {
    // Basic fields
    this.id = tab.id ?? null;
    this.openerTabId = tab.openerTabId ?? null;
    this.rowKey = String(tab.id ?? tab.sessionId ?? tab.url ?? `row-${Math.random().toString(36).slice(2)}`);
    // Prefer the pre-rendered L-bracket favicon over the raw favIconUrl.
    // markedFaviconDataUrl is set by markTabWithLBracket (OffscreenCanvas, extension context).
    const classified = tab as ClassifiedTab
    this.thumbnail = classified.markedFaviconDataUrl ?? tab.favIconUrl ?? ''

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
   * Thresholds come from globalStore DEFAULT_THRESHOLDS (young / middle / old).
   */
  private getAgeBgClass(days: number, thresholds: AppThresholds): string {
    if (!Number.isFinite(days) || days === Infinity) return 'bg-negative-3';
    if (days <= thresholds.young)  return 'bg-green-3';
    if (days <= thresholds.middle) return 'bg-yellow-3';
    if (days <= thresholds.old)    return 'bg-orange-3';
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
   * Static factory method to create multiple TabRows from array of Tabs.Tab
   */
  static fromTabs(tabs: Tabs.Tab[], thresholds: AppThresholds = DEFAULT_THRESHOLDS): TabRow[] {
    if (!Array.isArray(tabs)) return []
    return tabs.map((tab) => new TabRow(tab, thresholds))
  }
}
