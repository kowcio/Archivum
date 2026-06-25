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
    // Popup context: GroupUngroup component gets wrapped with "popup-btn-" prefix
    this.groupTabsBtn = page.getByTestId('popup-btn-group-tabs');
    this.openOptionsBtn = page.getByTestId('popup-btn-open-option-page');
    this.openPluginOptionsBtn = page.getByTestId('popup-btn-plugin-browser-option');
  }

  /**
   * Navigate to Popup page using extension ID.
   * Waits for networkidle to ensure popup fully renders.
   */
  async goto(extensionId: string): Promise<void> {
    await this.page.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: 'domcontentloaded',
    });
    // Extra wait for Vue app to mount and render buttons
    await this.page.waitForLoadState('networkidle');
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
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectAllButtonsVisible(): Promise<void> {
    await Promise.all([
      expect(this.groupTabsBtn).toBeVisible(),
      expect(this.openOptionsBtn).toBeVisible(),
      expect(this.openPluginOptionsBtn).toBeVisible(),
    ]);
  }

  /**
   * Verify Group Tabs button is visible.
   * Uses global Playwright timeout (15000ms from config).
   */
  async expectGroupButtonVisible(): Promise<void> {
    await expect(this.groupTabsBtn).toBeVisible();
  }

  /**
   * Close the page.
   */
  async close(): Promise<void> {
    await this.page.close();
  }
}

