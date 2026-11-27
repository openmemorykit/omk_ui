import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { ownStrictObject } from '../../../src/shared/report/own-strict-object'

const LabelledSchema = ownStrictObject({ label: v.string(), count: v.exactOptional(v.number()) })
const LABEL = 'label'
const COUNT = 2

class Labelled {
  readonly label = LABEL
}

describe('own strict object', () => {
  it('accepts the declared keys, with or without the optional one', () => {
    expect(v.safeParse(LabelledSchema, { label: LABEL }).success).toBe(true)
    expect(v.parse(LabelledSchema, { label: LABEL, count: COUNT })).toEqual({ label: LABEL, count: COUNT })
  })

  it('accepts an object without prototype', () => {
    const bare: Record<string, unknown> = Object.assign(Object.create(null) as Record<string, unknown>, { label: LABEL })
    expect(v.safeParse(LabelledSchema, bare).success).toBe(true)
  })

  it('refuses an unknown own key', () => {
    expect(v.safeParse(LabelledSchema, { label: LABEL, extra: 1 }).success).toBe(false)
  })

  it.each(['toString', 'constructor', 'hasOwnProperty', 'valueOf'])('refuses the own key %s that the prototype also names', (key) => {
    expect(v.safeParse(LabelledSchema, { label: LABEL, [key]: 1 }).success).toBe(false)
  })

  it('refuses an own __proto__ key', () => {
    expect(v.safeParse(LabelledSchema, JSON.parse('{"label":"label","__proto__":{}}')).success).toBe(false)
  })

  it.each([
    ['a class instance', new Labelled()],
    ['an array', [LABEL]],
    ['null', null],
    ['a string', LABEL],
  ])('refuses %s', (_name, input) => {
    expect(v.safeParse(LabelledSchema, input).success).toBe(false)
  })
})
