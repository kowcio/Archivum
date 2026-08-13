/// <reference types="chrome" />

/**
 * E2E test: Popup UI
 * Chrome MV3 only. Run:  npm run build-only && npx playwright test --project chrome-mv3
 */
import { expect, test } from '@playwright/test';
import { TestEnvironment } from './extensions.js';
import { PopupPage } from '../page-objects/PopupPage.js';

test.describe('Popup UI Tests', () => {
  let env: TestEnvironment

  test.beforeAll('Setup: launch Chrome context with extension', async () => {
    env = await TestEnvironment.create();
  });

  test.afterAll('Cleanup: close extension context', async () => {
    if (env) await env.cleanup();
  });

  test('1a service worker is registered', () => {
    expect(env.extensionId).toBeTruthy();
    expect(env.ctx.context.serviceWorkers().length).toBe(1);
  });

  test('2a popup renders all action buttons', async () => {
    const popup = new PopupPage(await env.ctx.context.newPage());
    await popup.goto(env.extensionId);
    await popup.expectAllButtonsVisible();
    await popup.close();
  });
});
