import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThresholds, isValid } from 'src/composables/useThresholds'
import { useGlobalStore, DEFAULT_THRESHOLDS } from 'src/stores/globalStore'

vi.mock('webextension-polyfill', () => ({
  default: {
    storage: {
      local: { get: vi.fn(() => Promise.resolve({})), set: vi.fn(() => Promise.resolve()) },
      onChanged: { addListener: vi.fn() },
    },
  },
}))

describe('useThresholds composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  // ─── isValid ───────────────────────────────────────────────────────────────

  describe('isValid()', () => {
    it('returns true for valid ordering', () => {
      expect(isValid({ young: 7, middle: 14, old: 21 })).toBe(true)
      expect(isValid({ young: 3, middle: 10, old: 30 })).toBe(true)
    })

    it('returns false when young >= middle', () => {
      expect(isValid({ young: 14, middle: 14, old: 21 })).toBe(false)
      expect(isValid({ young: 20, middle: 14, old: 21 })).toBe(false)
    })

    it('returns false when middle >= old', () => {
      expect(isValid({ young: 7, middle: 21, old: 21 })).toBe(false)
      expect(isValid({ young: 7, middle: 25, old: 21 })).toBe(false)
    })

    it('returns true when young is 0 (allowed for testing)', () => {
      expect(isValid({ young: 0, middle: 14, old: 21 })).toBe(true)
    })
  })

  // ─── thresholds reactive ref ───────────────────────────────────────────────

  describe('thresholds reactive ref', () => {
    it('reflects globalStore default values', () => {
      const { thresholds } = useThresholds()
      expect(thresholds.value).toEqual(DEFAULT_THRESHOLDS)
    })

    it('asArray returns [young, middle, old]', () => {
      const { asArray } = useThresholds()
      expect(asArray.value).toEqual([
        DEFAULT_THRESHOLDS.young,
        DEFAULT_THRESHOLDS.middle,
        DEFAULT_THRESHOLDS.old,
      ])
    })
  })

  // ─── setThreshold ──────────────────────────────────────────────────────────

  describe('setThreshold()', () => {
    it('updates a single key and persists via globalStore.setFlags', async () => {
      const { setThreshold, thresholds } = useThresholds()
      const globalStore = useGlobalStore()
      const setFlagsSpy = vi.spyOn(globalStore, 'setFlags')

      await setThreshold('young', 5)

      expect(thresholds.value.young).toBe(5)
      expect(setFlagsSpy).toHaveBeenCalledOnce()
    })

    it('rejects changes that violate young < middle ordering', async () => {
      const { setThreshold, thresholds } = useThresholds()
      const prev = thresholds.value.young

      await setThreshold('young', thresholds.value.middle) // young >= middle → invalid

      expect(thresholds.value.young).toBe(prev) // unchanged
    })

    it('rejects changes that violate middle < old ordering', async () => {
      const { setThreshold, thresholds } = useThresholds()
      const prev = thresholds.value.middle

      await setThreshold('middle', thresholds.value.old) // middle >= old → invalid

      expect(thresholds.value.middle).toBe(prev)
    })
  })

  // ─── setThresholds (batch) ─────────────────────────────────────────────────

  describe('setThresholds()', () => {
    it('applies a valid partial patch', async () => {
      const { setThresholds, thresholds } = useThresholds()

      await setThresholds({ young: 5, middle: 10 })

      expect(thresholds.value.young).toBe(5)
      expect(thresholds.value.middle).toBe(10)
      expect(thresholds.value.old).toBe(DEFAULT_THRESHOLDS.old) // unchanged
    })

    it('rejects an invalid patch without mutating state', async () => {
      const { setThresholds, thresholds } = useThresholds()
      const before = { ...thresholds.value }

      await setThresholds({ young: 30, middle: 5 }) // violates ordering

      expect(thresholds.value).toEqual(before)
    })
  })

  // ─── resetToDefaults ───────────────────────────────────────────────────────

  describe('resetToDefaults()', () => {
    it('restores APP_DEFAULTS values after custom changes', async () => {
      const { setThreshold, resetToDefaults, thresholds } = useThresholds()

      await setThreshold('young', 3)
      expect(thresholds.value.young).toBe(3)

      await resetToDefaults()

      expect(thresholds.value).toEqual(DEFAULT_THRESHOLDS)
    })
  })

  // ─── persistence ──────────────────────────────────────────────────────────

  describe('persistence', () => {
    it('stored thresholds loaded from storage override defaults', async () => {
      const globalStore = useGlobalStore()
      // Simulate a stored value different from defaults
      globalStore.$patch({
        flags: {
          ...globalStore.flags,
          thresholds: { young: 3, middle: 10, old: 30 },
        },
      })

      const { thresholds } = useThresholds()
      expect(thresholds.value).toEqual({ young: 3, middle: 10, old: 30 })
    })
  })
})

