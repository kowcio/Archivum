import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock must be defined inline to avoid hoisting issues
vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      query: vi.fn(),
    },
    tabGroups: {
      query: vi.fn(),
    },
    windows: {
      WINDOW_ID_CURRENT: -2,
    },
    storage: {
      local: {
        set: vi.fn(),
      },
    },
  },
}))

import { BackupService, type Backup } from '@/services/BackupService'
import { browser } from 'wxt/browser'

const mockBrowser = vi.mocked(browser)

describe('BackupService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Reset mock browser state
    mockBrowser.tabGroups = {
      query: vi.fn(),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should auto-backup tabs and groups', async () => {
    const mockTime = new Date('2026-07-03T15:00:00').getTime()
    vi.setSystemTime(mockTime)

    const mockTabs = [
      { id: 1, title: 'Tab 1', url: 'https://example.com' },
      { id: 2, title: 'Tab 2', url: 'https://google.com' },
    ]

    const mockGroups = [
      { id: 100, title: 'Week+', color: 'green' },
      { id: 101, title: 'Month+', color: 'orange' },
    ]

    mockBrowser.tabs.query.mockResolvedValue(mockTabs)
    mockBrowser.tabGroups.query.mockResolvedValue(mockGroups)
    mockBrowser.storage.local.set.mockResolvedValue(undefined)

    await BackupService.autoBackupTabs()

    // Verify storage.local.set was called
    expect(mockBrowser.storage.local.set).toHaveBeenCalledOnce()

    const callArg = mockBrowser.storage.local.set.mock.calls[0][0]
    const backup = callArg['local:backup'] as Backup

    expect(backup.count).toBe(2)
    expect(backup.tabs).toEqual(mockTabs)
    expect(backup.groups).toHaveLength(2)
    expect(backup.groups[0]).toEqual({
      oldId: 100,
      title: 'Week+',
      color: 'green',
    })
    expect(backup.createdAt).toBe(mockTime)
  })

  it('should handle missing tabGroups gracefully (Firefox)', async () => {
    // Setup: mock browser with no tabGroups
    mockBrowser.tabs.query.mockResolvedValue([
      { id: 1, title: 'Tab 1', url: 'https://example.com' },
    ])
    mockBrowser.tabGroups = null as any
    mockBrowser.storage.local.set.mockResolvedValue(undefined)

    // Should not throw, just complete
    await BackupService.autoBackupTabs()

    // Verify it was called even with null tabGroups
    expect(mockBrowser.storage.local.set).toHaveBeenCalled()
  })

  it('should store backup with current timestamp', async () => {
    const mockTime = new Date('2026-07-03T14:30:00').getTime()
    vi.setSystemTime(mockTime)

    mockBrowser.tabs.query.mockResolvedValue([])
    mockBrowser.tabGroups.query.mockResolvedValue([])
    mockBrowser.storage.local.set.mockResolvedValue(undefined)

    await BackupService.autoBackupTabs()

    const callArg = mockBrowser.storage.local.set.mock.calls[0][0]
    const backup = callArg['local:backup'] as Backup

    expect(backup.createdAt).toBe(mockTime)
  })

  it('should handle errors gracefully', async () => {
    mockBrowser.tabs.query.mockRejectedValue(new Error('Query failed'))

    const consoleSpy = vi.spyOn(console, 'error')

    await BackupService.autoBackupTabs()

    expect(consoleSpy).toHaveBeenCalledWith(
      '[BackupService] ❌ Auto-backup failed:',
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })
})
