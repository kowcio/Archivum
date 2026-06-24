import { describe, it, expect } from 'vitest'
import { AppThresholds, DEFAULT_THRESHOLDS } from 'src/models/AppThresholds'
import type { ThresholdLevel } from 'src/constants'

describe('AppThresholds model', () => {
  // ─── Constructor ─────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates instance with given levels array', () => {
      const levels: ThresholdLevel[] = [
        { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ]
      const t = new AppThresholds(levels)
      expect(t.levels).toEqual(levels)
      expect(t.levels[0]).toEqual(levels[0])
      expect(t.levels[1]).toEqual(levels[1])
      expect(t.levels[2]).toEqual(levels[2])
    })

    it('supports dynamic number of levels', () => {
      const levels: ThresholdLevel[] = [
        { key: 'l0', label: 'L0', days: 5, color: '#ffd740' },
        { key: 'l1', label: 'L1', days: 10, color: '#ff6d00' },
        { key: 'l2', label: 'L2', days: 20, color: '#ff1744' },
        { key: 'l3', label: 'L3', days: 30, color: '#d32f2f' },
      ]
      const t = new AppThresholds(levels)
      expect(t.levels).toHaveLength(4)
      expect(t.levels[3].days).toBe(30)
    })
  })

  // ─── isValid() ───────────────────────────────────────────────────────────

  describe('isValid()', () => {
    it('returns true for valid ordering: level[0] < level[1] < level[2]', () => {
      const t1 = new AppThresholds([
        { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      expect(t1.isValid()).toBe(true)
    })

    it('returns true when level[0] is 0 (minimum allowed)', () => {
      const t = new AppThresholds([
        { key: 'y', label: 'Young', days: 0, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      expect(t.isValid()).toBe(true)
    })

    it('returns false when level[i] >= level[i+1]', () => {
      const t1 = new AppThresholds([
        { key: 'y', label: 'Young', days: 14, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      expect(t1.isValid()).toBe(false)
    })

    it('returns false when level[0] < 0', () => {
      const t = new AppThresholds([
        { key: 'y', label: 'Young', days: -1, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      expect(t.isValid()).toBe(false)
    })
  })

  // ─── toBoundaries() ──────────────────────────────────────────────────────

  describe('toBoundaries()', () => {
    it('returns array of days values', () => {
      const t = new AppThresholds([
        { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      expect(t.toBoundaries()).toEqual([7, 14, 21])
    })

    it('returns array with dynamic length', () => {
      const t = new AppThresholds([
        { key: 'l0', label: 'L0', days: 5, color: '#ffd740' },
        { key: 'l1', label: 'L1', days: 10, color: '#ff6d00' },
        { key: 'l2', label: 'L2', days: 20, color: '#ff1744' },
        { key: 'l3', label: 'L3', days: 30, color: '#d32f2f' },
      ])
      expect(t.toBoundaries()).toEqual([5, 10, 20, 30])
    })

    it('can be used with findIndex for age classification', () => {
      const t = new AppThresholds([
        { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      const boundaries = t.toBoundaries()

      expect(boundaries.findIndex(threshold => 5 <= threshold)).toBe(0)   // 5 days → level 0
      expect(boundaries.findIndex(threshold => 10 <= threshold)).toBe(1)  // 10 days → level 1
      expect(boundaries.findIndex(threshold => 20 <= threshold)).toBe(2)  // 20 days → level 2
      expect(boundaries.findIndex(threshold => 30 <= threshold)).toBe(-1) // 30 days → beyond all
    })
  })

  // ─── merge() ─────────────────────────────────────────────────────────────

  describe('merge()', () => {
    it('creates new instance with partial update by index', () => {
      const original = new AppThresholds([
        { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      const updated = original.merge({ 0: { days: 5 } })

      expect(updated.levels[0].days).toBe(5)
      expect(updated.levels[1].days).toBe(14)
      expect(updated.levels[2].days).toBe(21)
      expect(updated).not.toBe(original) // new instance
    })

    it('updates multiple values at once', () => {
      const original = new AppThresholds([
        { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      const updated = original.merge({
        0: { days: 5 },
        1: { days: 12 }
      })

      expect(updated.levels[0].days).toBe(5)
      expect(updated.levels[1].days).toBe(12)
      expect(updated.levels[2].days).toBe(21)
    })

    it('preserves unchanged values', () => {
      const original = new AppThresholds([
        { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      const updated = original.merge({ 1: { days: 10 } })

      expect(updated.levels[0].days).toBe(7)
      expect(updated.levels[1].days).toBe(10)
      expect(updated.levels[2].days).toBe(21)
    })

    it('returns new instance even if no changes', () => {
      const original = new AppThresholds([
        { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      const updated = original.merge({})

      expect(updated).not.toBe(original)
      expect(updated.levels[0].days).toBe(7)
      expect(updated.levels[1].days).toBe(14)
      expect(updated.levels[2].days).toBe(21)
    })
  })

  // ─── toJSON() ────────────────────────────────────────────────────────────

  describe('toJSON()', () => {
    it('serializes to plain object with levels array', () => {
      const t = new AppThresholds([
        { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      const json = t.toJSON()

      expect(json.levels).toHaveLength(3)
      expect(json.levels[0].days).toBe(7)
      expect(json.levels[1].days).toBe(14)
      expect(json.levels[2].days).toBe(21)
      expect(json).not.toBeInstanceOf(AppThresholds)
    })

    it('can be used with JSON.stringify', () => {
      const t = new AppThresholds([
        { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      const str = JSON.stringify(t)

      expect(str).toContain('"days":7')
      expect(str).toContain('"days":14')
      expect(str).toContain('"days":21')
    })
  })

  // ─── fromObject() ────────────────────────────────────────────────────────

  describe('fromObject()', () => {
    it('creates instance from plain object with levels array', () => {
      const obj = {
        levels: [
          { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
          { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
          { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
        ]
      }
      const t = AppThresholds.fromObject(obj)

      expect(t).toBeInstanceOf(AppThresholds)
      expect(t.levels[0].days).toBe(7)
      expect(t.levels[1].days).toBe(14)
      expect(t.levels[2].days).toBe(21)
    })

    it('can deserialize JSON.parse result', () => {
      const json = '{"levels":[{"key":"y","label":"Young","days":7,"color":"#ffd740"},{"key":"m","label":"Middle","days":14,"color":"#ff6d00"},{"key":"o","label":"Old","days":21,"color":"#ff1744"}]}'
      const obj = JSON.parse(json)
      const t = AppThresholds.fromObject(obj)

      expect(t).toBeInstanceOf(AppThresholds)
      expect(t.levels[0].days).toBe(7)
    })

    it('round-trip: fromObject(toJSON()) returns equivalent instance', () => {
      const original = new AppThresholds([
        { key: 'y', label: 'Young', days: 7, color: '#ffd740' },
        { key: 'm', label: 'Middle', days: 14, color: '#ff6d00' },
        { key: 'o', label: 'Old', days: 21, color: '#ff1744' }
      ])
      const roundtrip = AppThresholds.fromObject(original.toJSON())

      expect(roundtrip.levels[0].days).toBe(original.levels[0].days)
      expect(roundtrip.levels[1].days).toBe(original.levels[1].days)
      expect(roundtrip.levels[2].days).toBe(original.levels[2].days)
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

    it('has the correct number of levels based on THRESHOLDS.activeLevels', () => {
      // From APP_DEFAULTS.THRESHOLDS.activeLevels
      expect(DEFAULT_THRESHOLDS.levels.length).toBeGreaterThanOrEqual(3)
    })

    it('has levels with increasing days', () => {
      for (let i = 1; i < DEFAULT_THRESHOLDS.levels.length; i++) {
        expect(DEFAULT_THRESHOLDS.levels[i].days).toBeGreaterThan(
          DEFAULT_THRESHOLDS.levels[i - 1].days
        )
      }
    })
  })
})



