/**
 * PopupPage — Page Object Model for Extension Popup page.
 *
 * Encapsulates all interactions with the Popup UI:
 * - Button clicks (group, open options, etc.)
 * - Element visibility checks
 * - Navigation
 *
 * Usage:
 *   const popup = new PopupPage(page);
 *   await popup.goto(extensionId);
 *   await popup.expectAllButtonsVisible();
 */

import { expect, type Locator, type Page } from '@playwright/test';

export class PopupPage {
  private readonly groupTabsBtn: Locator;
  private readonly openOptionsBtn: Locator;
  private readonly openPluginOptionsBtn: Locator;

  constructor(public readonly page: Page) {
    this.groupTabsBtn = page.getByTestId('group-tabs-btn');
    this.openOptionsBtn = page.getByTestId('popup-btn-open-option-page');
    this.openPluginOptionsBtn = page.getByTestId('popup-btn-plugin-browser-option');
  }

  /**
   * Navigate to Popup page using extension ID.
   */
  async goto(extensionId: string): Promise<void> {
    await this.page.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: 'domcontentloaded',
    });
  }

  /**
   * Click "Group Tabs by Age" button.
   */
  async clickGroupTabs(): Promise<void> {
    await this.groupTabsBtn.click();
  }

  /**
   * Click "Open Options" button.
   */
  async clickOpenOptions(): Promise<void> {
    await this.openOptionsBtn.click();
  }

  /**
   * Click "Open Plugin Browser Options" button.
   */
  async clickOpenPluginOptions(): Promise<void> {
    await this.openPluginOptionsBtn.click();
  }

  /**
   * Verify all action buttons are visible.
   */
  async expectAllButtonsVisible(): Promise<void> {
    await Promise.all([
      expect(this.groupTabsBtn).toBeVisible({ timeout: 3000 }),
      expect(this.openOptionsBtn).toBeVisible({ timeout: 3000 }),
      expect(this.openPluginOptionsBtn).toBeVisible({ timeout: 3000 }),
    ]);
  }

  /**
   * Verify Group Tabs button is visible.
   */
  async expectGroupButtonVisible(): Promise<void> {
    await expect(this.groupTabsBtn).toBeVisible({ timeout: 3000 });
  }

  /**
   * Close the page.
   */
  async close(): Promise<void> {
    await this.page.close();
  }
}

