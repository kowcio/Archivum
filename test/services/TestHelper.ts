/**
 * 🧪 Test Helper Service (DEPRECATED)
 *
 * This module is kept for backward compatibility but is no longer actively used.
 *
 * ✅ Modern approach: Use RPC messaging directly in page.evaluate() instead.
 * This avoids loading @webext-core/proxy-service in Node.js test context,
 * which would trigger webextension-polyfill's browser context check.
 *
 * Migration example:
 * ```
 * // ❌ OLD (in OptionsPage methods):
 * const tabs = await TestHelper.createMockTabs()
 *
 * // ✅ NEW (in page.evaluate):
 * await page.evaluate(async () => {
 *   return new Promise((resolve) => {
 *     chrome.runtime.sendMessage(
 *       { type: 'proxy-service.background', data: { path: ['createMockTabs'], args: [] }, timestamp: Date.now() },
 *       response => resolve(response?.res)
 *     )
 *   })
 * })
 * ```
 */

// Legacy export for backward compatibility (unused in current tests)
export const TestHelper = {
   createMockTabs: async () => { throw new Error('Use page.evaluate() instead') },
   setMockOverrides: async () => { throw new Error('Use page.evaluate() instead') },
   getMockOverrides: async () => { throw new Error('Use page.evaluate() instead') },
   openRandomTabInGroup: async () => { throw new Error('Use page.evaluate() instead') },
} as const

export type TestHelperType = typeof TestHelper
