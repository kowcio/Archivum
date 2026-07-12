/**
 * 🧪 Test Helper Service
 *
 * Provides direct access to test-only and test-utility methods for Playwright tests.
 * Calls RPC methods through the proxy service (extension context) instead of directly
 * importing Node.js dependencies.
 *
 * Usage in Playwright tests:
 * ```typescript
 * import { TestHelper } from '../services/TestHelper'
 * await TestHelper.createMockTabs()
 * await TestHelper.setMockOverrides({ [tabId]: timestamp })
 * await TestHelper.openRandomTabInGroup()
 * ```
 *
 * Why use RPC?
 * - Methods execute in extension context (where browser API is available)
 * - No direct imports of extension code into Node.js context
 * - Cleaner test isolation
 * - Same as production UI does
 */

import { createProxyService } from '@webext-core/proxy-service'
import type { BackgroundRPC } from '@/services/BackgroundRPC'

// ✅ RPC proxy to call extension methods from test context
const background = createProxyService<BackgroundRPC>('background')

/**
 * Direct test helper interface — calls extension RPC methods.
 * Imported and called directly by test code.
 */
export const TestHelper = {
  /**
   * 🧪 Create 14 mock tabs with backdated lastAccessed for age testing.
   * @returns Created mock tabs
   */
  createMockTabs: async () => {
    return background.createMockTabs()
  },

  /**
   * 🧪 Set mock age overrides in storage.
   * Simulates tabs aging by overriding their lastAccessed times.
   * @param overrides - Map of tabId → custom lastAccessed timestamp
   */
  setMockOverrides: async (overrides: Record<number, number>) => {
    return background.setMockOverrides(overrides)
  },

  /**
   * 🧪 Get current mock overrides from storage.
   * @returns Current overrides map
   */
  getMockOverrides: async () => {
    return background.getMockOverrides()
  },

  /**
   * 🧪 Test utility: Open a random tab, optionally in a group.
   * This is a wrapper around the production RPC method for testing convenience.
   * @param newTabGroup - Whether to create a new group for the tab
   * @param index - Optional group index
   * @returns Generated alphanumeric ID
   */
  openRandomTabInGroup: async (newTabGroup: boolean = false, index?: number) => {
    return background.openRandomTabInGroup(newTabGroup, index)
  },
} as const

export type TestHelperType = typeof TestHelper
