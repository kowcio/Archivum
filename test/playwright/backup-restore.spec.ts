/**
 * Backup & Restore E2E Test
 *
 * Happy path: Create mock grouped tabs → Backup → Close all → Restore
 * Verifies that groups and tabs are properly restored.
 */

import { test, expect } from '@playwright/test'
import { setupExtensionTest } from './chromium/extensions.js'
import { OptionsPage } from './page-objects/OptionsPage.js'

test.describe('Backup & Restore', () => {
  test('Happy path: backup grouped tabs, close all, restore with groups intact', async () => {
    const ctx = await setupExtensionTest(false, 60_000)
    const options = new OptionsPage(await ctx.context.newPage())

    // Load options
    await options.goto(ctx.extensionId)

    // Create mock tabs
    await options.clickCloseAllTabs()
    await options.page.waitForTimeout(500)
    await options.clickLoadMockTabs()
    await options.page.waitForTimeout(1000)

    // Group tabs by age
    await options.clickGroupTabs(2000)
    const groupsBefore = await options.getGroupCount()
    await options.getAllGroups().then(groups => {
      console.log("BEFORE ")
      groups.forEach(group => {
        console.log(group)
      })
    })
    // Backup
    await options.clickBackupTabs()
    await options.page.waitForTimeout(500)

    // Close all tabs
    await options.clickCloseAllTabs()
    await options.page.waitForTimeout(500)

    // Restore
    await options.clickRestoreTabs()
    await options.confirmRestore()
    await options.page.waitForTimeout(2000)

    // Verify groups restored — fetch from scratch (exact count)
    const groupDetailsAfter = await options.getAllGroups()
    await options.getAllGroups().then(groups => {
      console.log("AFTER ")
      groups.forEach(group => {
        console.log(group)
      })
    })
    expect(groupDetailsAfter.length).toBe(groupsBefore)

    // Cleanup
    await ctx.cleanup()
  })

  test('Delete backup after successful restore', async () => {
    const ctx = await setupExtensionTest(false, 60_000)
    const options = new OptionsPage(await ctx.context.newPage())

    // Load options
    await options.goto(ctx.extensionId)

    // Create mock tabs
    await options.clickCloseAllTabs()
    await options.page.waitForTimeout(500)
    await options.clickLoadMockTabs()
    await options.page.waitForTimeout(1000)

    // Group tabs by age
    await options.clickGroupTabs(2000)

    // Backup
    await options.clickBackupTabs()
    await options.page.waitForTimeout(500)

    // Verify backup exists (delete button should be visible)
    await options.expectDeleteBackupButtonVisible()
    await options.expectRestoreButtonVisible()

    // Delete the backup
    await options.clickDeleteBackup()
    await options.page.waitForTimeout(500)

    // Verify backup is deleted (delete button and restore button should be hidden)
    await options.expectDeleteBackupButtonHidden()
    await options.expectRestoreButtonHidden()

    // Verify backup was actually removed from storage
    const backupData = await options.getBackupFromStorage()
    expect(backupData).toBeNull()

    // Cleanup
    await ctx.cleanup()
  })
})


