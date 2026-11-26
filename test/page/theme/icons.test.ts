import { IconName } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { ICON_PATHS } from '../../../src/page/theme/icons'

const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/

describe('ICON_PATHS', () => {
  it('has at least one path for every icon name', () => {
    for (const name of Object.values(IconName)) {
      expect(ICON_PATHS[name].length, name).toBeGreaterThan(0)
    }
  })

  it('has no path for a name outside the vocabulary', () => {
    expect(Object.keys(ICON_PATHS).sort()).toEqual(Object.values(IconName).sort())
  })

  it('holds plain path data only, so it can be bound to d without injection risk', () => {
    for (const paths of Object.values(ICON_PATHS)) {
      for (const path of paths) expect(path).toMatch(PATH_DATA)
    }
  })
})
