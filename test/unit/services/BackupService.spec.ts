import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock browser API BEFORE importing BackupService
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

// NOW import after mocking
import { BackupService, type Backup } from '@/services/BackupService'
import { browser } from 'wxt/browser'

describe('BackupService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
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

    vi.mocked(browser.tabs.query).mockResolvedValue(mockTabs as any)
    vi.mocked(browser.tabGroups.query).mockResolvedValue(mockGroups as any)
    vi.mocked(browser.storage.local.set).mockResolvedValue(undefined)

    await BackupService.autoBackupTabs()

    expect(vi.mocked(browser.storage.local.set)).toHaveBeenCalledOnce()

    const callArg = vi.mocked(browser.storage.local.set).mock.calls[0][0] as Record<string, Backup>
    const backup = callArg['local:backup']

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

  it('should store backup with current timestamp', async () => {
    const mockTime = new Date('2026-07-03T14:30:00').getTime()
    vi.setSystemTime(mockTime)

    vi.mocked(browser.tabs.query).mockResolvedValue([] as any)
    vi.mocked(browser.tabGroups.query).mockResolvedValue([] as any)
    vi.mocked(browser.storage.local.set).mockResolvedValue(undefined)

    await BackupService.autoBackupTabs()

    const callArg = vi.mocked(browser.storage.local.set).mock.calls[0][0] as Record<string, Backup>
    const backup = callArg['local:backup']

    expect(backup.createdAt).toBe(mockTime)
  })

  it('should handle errors gracefully', async () => {
    vi.mocked(browser.tabs.query).mockRejectedValue(new Error('Query failed'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await BackupService.autoBackupTabs()

    expect(consoleSpy).toHaveBeenCalledWith(
      '[BackupService] ❌ Auto-backup failed:',
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })
})
