import { describe, expect, it } from 'vitest'
import { Modality } from '../../../src/protocol/intents'
import { ToPage } from '../../../src/protocol/to-page'
import { TO_PAGE_SAMPLES } from '../../fixtures/messages'
import { createNuiFake } from './nui-fake'

const TOKEN = 'token-1'

describe('NuiPort fake', () => {
  it('records every message sent, and filters them by type', () => {
    const nui = createNuiFake()
    nui.send(TO_PAGE_SAMPLES[ToPage.OpenRadial])
    nui.send({ type: ToPage.Modality, modality: Modality.Gamepad })
    expect(nui.sent).toStrictEqual([TO_PAGE_SAMPLES[ToPage.OpenRadial], { type: ToPage.Modality, modality: Modality.Gamepad }])
    expect(nui.sentOfType(ToPage.Modality)).toStrictEqual([{ type: ToPage.Modality, modality: Modality.Gamepad }])
  })

  it('records the boot with its session token apart from the other messages', () => {
    const nui = createNuiFake()
    nui.sendBoot(TO_PAGE_SAMPLES[ToPage.Boot], TOKEN)
    expect(nui.boots).toStrictEqual([{ message: TO_PAGE_SAMPLES[ToPage.Boot], sessionToken: TOKEN }])
    expect(nui.sent).toStrictEqual([])
  })

  it('records focus and keepInput changes and reports the current keepInput', () => {
    const nui = createNuiFake()
    nui.setFocus(true, false)
    nui.setKeepInput(true)
    expect(nui.focusChanges).toStrictEqual([{ focus: true, cursor: false }])
    expect(nui.isKeepingInput()).toBe(true)
    nui.keepInputFromAnotherResource(false)
    expect(nui.isKeepingInput()).toBe(false)
    expect(nui.keepInputChanges).toStrictEqual([true])
  })

  it('keeps every call in order', () => {
    const nui = createNuiFake()
    nui.setKeepInput(false)
    nui.setFocus(false, false)
    expect(nui.calls.map((call) => call.args)).toStrictEqual([[false], [false, false]])
  })
})
