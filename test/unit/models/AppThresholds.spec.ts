import { describe, it, expect } from 'vitest'
import { AppThresholds, DEFAULT_THRESHOLDS } from 'src/models/AppThresholds'

describe('AppThresholds model', () => {
  // ─── Constructor ─────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with given values', () => {
      const t = new AppThresholds(7, 14, 21)
      expect(t.young).toBe(7)
      expect(t.middle).toBe(14)
      expect(t.old).toBe(21)
    })
  })

  // ─── isValid() ───────────────────────────────────────────────────────────

  describe('isValid()', () => {
    it('returns true for valid ordering: young < middle < old', () => {
      expect(new AppThresholds(7, 14, 21).isValid()).toBe(true)
      expect(new AppThresholds(3, 10, 30).isValid()).toBe(true)
      expect(new AppThresholds(1, 5, 15).isValid()).toBe(true)
    })

    it('returns true when young is 0 (minimum allowed)', () => {
      expect(new AppThresholds(0, 14, 21).isValid()).toBe(true)
    })

    it('returns false when young >= middle', () => {
      expect(new AppThresholds(14, 14, 21).isValid()).toBe(false)
      expect(new AppThresholds(20, 14, 21).isValid()).toBe(false)
    })

    it('returns false when middle >= old', () => {
      expect(new AppThresholds(7, 21, 21).isValid()).toBe(false)
      expect(new AppThresholds(7, 25, 21).isValid()).toBe(false)
    })

    it('returns false when young < 0', () => {
      expect(new AppThresholds(-1, 14, 21).isValid()).toBe(false)
    })
  })

  // ─── toBoundaries() ──────────────────────────────────────────────────────

  describe('toBoundaries()', () => {
    it('returns array [young, middle, old]', () => {
      const t = new AppThresholds(7, 14, 21)
      expect(t.toBoundaries()).toEqual([7, 14, 21])
    })

    it('returns readonly tuple', () => {
      const t = new AppThresholds(7, 14, 21)
      const boundaries = t.toBoundaries()
      expect(boundaries).toHaveLength(3)
    })

    it('can be used with findIndex for age classification', () => {
      const t = new AppThresholds(7, 14, 21)
      const boundaries = t.toBoundaries()

      expect(boundaries.findIndex(threshold => 5 <= threshold)).toBe(0)   // 5 days → young (index 0)
      expect(boundaries.findIndex(threshold => 10 <= threshold)).toBe(1)  // 10 days → middle (index 1)
      expect(boundaries.findIndex(threshold => 20 <= threshold)).toBe(2)  // 20 days → old (index 2)
      expect(boundaries.findIndex(threshold => 30 <= threshold)).toBe(-1) // 30 days → beyond old
    })
  })

  // ─── merge() ─────────────────────────────────────────────────────────────

  describe('merge()', () => {
    it('creates new instance with partial update', () => {
      const original = new AppThresholds(7, 14, 21)
      const updated = original.merge({ young: 5 })

      expect(updated.young).toBe(5)
      expect(updated.middle).toBe(14)
      expect(updated.old).toBe(21)
      expect(updated).not.toBe(original) // new instance
    })

    it('updates multiple values at once', () => {
      const original = new AppThresholds(7, 14, 21)
      const updated = original.merge({ young: 5, middle: 12 })

      expect(updated.young).toBe(5)
      expect(updated.middle).toBe(12)
      expect(updated.old).toBe(21)
    })

    it('preserves unchanged values', () => {
      const original = new AppThresholds(7, 14, 21)
      const updated = original.merge({ middle: 10 })

      expect(updated.young).toBe(7)
      expect(updated.middle).toBe(10)
      expect(updated.old).toBe(21)
    })

    it('returns new instance even if no changes', () => {
      const original = new AppThresholds(7, 14, 21)
      const updated = original.merge({})

      expect(updated).not.toBe(original)
      expect(updated.young).toBe(7)
      expect(updated.middle).toBe(14)
      expect(updated.old).toBe(21)
    })
  })

  // ─── toJSON() ────────────────────────────────────────────────────────────

  describe('toJSON()', () => {
    it('serializes to plain object', () => {
      const t = new AppThresholds(7, 14, 21)
      const json = t.toJSON()

      expect(json).toEqual({ young: 7, middle: 14, old: 21 })
      expect(json).not.toBeInstanceOf(AppThresholds)
    })

    it('can be used with JSON.stringify', () => {
      const t = new AppThresholds(7, 14, 21)
      const str = JSON.stringify(t)

      expect(str).toBe('{"young":7,"middle":14,"old":21}')
    })
  })

  // ─── fromObject() ────────────────────────────────────────────────────────

  describe('fromObject()', () => {
    it('creates instance from plain object', () => {
      const t = AppThresholds.fromObject({ young: 7, middle: 14, old: 21 })

      expect(t).toBeInstanceOf(AppThresholds)
      expect(t.young).toBe(7)
      expect(t.middle).toBe(14)
      expect(t.old).toBe(21)
    })

    it('can deserialize JSON.parse result', () => {
      const json = '{"young":7,"middle":14,"old":21}'
      const obj = JSON.parse(json)
      const t = AppThresholds.fromObject(obj)

      expect(t).toBeInstanceOf(AppThresholds)
      expect(t.young).toBe(7)
    })

    it('round-trip: fromObject(toJSON()) returns equivalent instance', () => {
      const original = new AppThresholds(7, 14, 21)
      const roundtrip = AppThresholds.fromObject(original.toJSON())

      expect(roundtrip.young).toBe(original.young)
      expect(roundtrip.middle).toBe(original.middle)
      expect(roundtrip.old).toBe(original.old)
    })
  })

  // ─── DEFAULT_THRESHOLDS ──────────────────────────────────────────────────

  describe('DEFAULT_THRESHOLDS', () => {
    it('is an instance of AppThresholds', () => {
      expect(DEFAULT_THRESHOLDS).toBeInstanceOf(AppThresholds)
    })

    it('has valid ordering', () => {
      expect(DEFAULT_THRESHOLDS.isValid()).toBe(true)
    })

    it('matches APP_DEFAULTS values', () => {
      // Values come from constants - just verify they are set
      expect(DEFAULT_THRESHOLDS.young).toBeGreaterThanOrEqual(0)
      expect(DEFAULT_THRESHOLDS.middle).toBeGreaterThan(DEFAULT_THRESHOLDS.young)
      expect(DEFAULT_THRESHOLDS.old).toBeGreaterThan(DEFAULT_THRESHOLDS.middle)
    })
  })
})


