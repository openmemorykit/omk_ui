import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { FromPage } from '../../../src/protocol/from-page'
import { ToPage, type ToPageMessage, type ToPageMessageOf } from '../../../src/protocol/to-page'
import { createNuiPort } from '../../../src/client/infrastructure/nui'
import { registerNuiCallbacks } from '../../../src/client/infrastructure/nui-callbacks'
import { GlyphSet, UiMode } from '../../../src/protocol/page-vocabulary'
import { DEFAULT_CONFIG } from '../../../src/shared/config/config-schema'

type Callback = (body: unknown, respond: (result: unknown) => void) => void

const TOKEN = 'token-1'
const GLYPH_MESSAGE: ToPageMessage = { type: ToPage.GlyphSet, glyphSet: GlyphSet.Xbox }
const BOOT: ToPageMessageOf<typeof ToPage.Boot> = {
  type: ToPage.Boot,
  settings: DEFAULT_CONFIG.theme,
  locale: { language: 'en', messages: {} },
  glyphSet: GlyphSet.Xbox,
  bindings: { radial: 'F1', interact: 'E', pushToTalk: 'N' },
  radialEntries: [],
  panels: [],
  confirm: null,
  prompt: null,
  commandSeq: 0,
}

let natives: NativeRecorder | null = null
const failures: unknown[][] = []
const onFailure = (operation: string, cause: unknown): void => { failures.push([operation, cause]) }

afterEach(() => {
  natives?.restore()
  natives = null
  failures.length = 0
})

function install(overrides: Readonly<Record<string, (...args: never[]) => unknown>> = {}): NativeRecorder {
  natives = installNatives({
    SendNuiMessage: () => true,
    SetNuiFocus: () => undefined,
    SetNuiFocusKeepInput: () => undefined,
    IsNuiFocusKeepingInput: () => false,
    ...overrides,
  })
  return natives
}

describe('createNuiPort', () => {
  it('sends a message to the page as JSON', () => {
    const recorder = install()
    createNuiPort(onFailure).send(GLYPH_MESSAGE)
    expect(recorder.callsOf('SendNuiMessage')).toEqual([[JSON.stringify(GLYPH_MESSAGE)]])
  })

  it('adds the session token to the boot message body, and to no other message', () => {
    const recorder = install()
    const port = createNuiPort(onFailure)
    port.sendBoot(BOOT, TOKEN)
    port.send({ type: ToPage.GlyphSet, glyphSet: GlyphSet.Xbox })
    const [boot, other] = recorder.callsOf('SendNuiMessage').map(([json]) => JSON.parse(json as string) as Record<string, unknown>)
    expect(boot).toEqual({ ...JSON.parse(JSON.stringify(BOOT)) as object, sessionToken: TOKEN })
    expect(other).toEqual({ type: ToPage.GlyphSet, glyphSet: GlyphSet.Xbox })
  })

  it('calls SetNuiFocus then SetNuiFocusKeepInput in the order the application asks', () => {
    const recorder = install()
    const port = createNuiPort(onFailure)
    port.setFocus(true, false)
    port.setKeepInput(true)
    port.setFocus(false, false)
    port.setKeepInput(false)
    expect(recorder.calls).toEqual([
      { name: 'SetNuiFocus', args: [true, false] },
      { name: 'SetNuiFocusKeepInput', args: [true] },
      { name: 'SetNuiFocus', args: [false, false] },
      { name: 'SetNuiFocusKeepInput', args: [false] },
    ])
  })

  it('reads whether the focus keeps the input from IsNuiFocusKeepingInput', () => {
    install({ IsNuiFocusKeepingInput: () => true })
    expect(createNuiPort(onFailure).isKeepingInput()).toBe(true)
  })

  it('reports a failing native and lets nothing escape', () => {
    const boom = new Error('boom')
    install({ SendNuiMessage: () => { throw boom }, SetNuiFocus: () => { throw boom }, SetNuiFocusKeepInput: () => { throw boom }, IsNuiFocusKeepingInput: () => { throw boom } })
    const port = createNuiPort(onFailure)
    port.send(GLYPH_MESSAGE)
    port.sendBoot(BOOT, TOKEN)
    port.setFocus(true, true)
    port.setKeepInput(true)
    expect(port.isKeepingInput()).toBe(false)
    expect(failures.map(([operation]) => operation)).toEqual(['SendNuiMessage', 'SendNuiMessage', 'SetNuiFocus', 'SetNuiFocusKeepInput', 'IsNuiFocusKeepingInput'])
  })

  it('reports a message that cannot be turned into JSON', () => {
    install()
    const circular: Record<string, unknown> = { type: ToPage.GlyphSet }
    circular['self'] = circular
    createNuiPort(onFailure).send(circular as unknown as ToPageMessage)
    expect(failures.length).toBe(1)
  })
})

function registered(): { readonly callbacks: Map<string, Callback>; readonly order: string[] } {
  const callbacks = new Map<string, Callback>()
  const order: string[] = []
  install({ RegisterNuiCallback: (type: string, callback: Callback) => { callbacks.set(type, callback) } })
  return { callbacks, order }
}

describe('registerNuiCallbacks', () => {
  it('registers one callback per FromPage member, named by its value, before returning', () => {
    const { callbacks } = registered()
    registerNuiCallbacks(() => undefined, onFailure)
    expect([...callbacks.keys()].sort()).toEqual(Object.values(FromPage).sort())
  })

  it('answers the page with an empty object right away, before the handler runs', () => {
    const { callbacks, order } = registered()
    registerNuiCallbacks((type) => { order.push(`handle ${type}`) }, onFailure)
    Object.values(FromPage).forEach((type) => {
      order.length = 0
      const answers: unknown[] = []
      callbacks.get(type)?.({ any: 'body' }, (answer) => { order.push('respond'); answers.push(answer) })
      expect(order, type).toEqual(['respond', `handle ${type}`])
      expect(answers, type).toEqual([{}])
    })
  })

  it('hands the callback type and body to the handler', () => {
    const { callbacks } = registered()
    const handled: unknown[][] = []
    registerNuiCallbacks((type, body) => { handled.push([type, body]) }, onFailure)
    callbacks.get(FromPage.Ack)?.({ lastIntentSeq: 4, sessionToken: TOKEN }, () => undefined)
    expect(handled).toEqual([[FromPage.Ack, { lastIntentSeq: 4, sessionToken: TOKEN }]])
  })

  it('reports a handler that throws and still answers the page', () => {
    const { callbacks } = registered()
    const boom = new Error('boom')
    registerNuiCallbacks(() => { throw boom }, onFailure)
    const answers: unknown[] = []
    callbacks.get(FromPage.Event)?.({}, (answer) => answers.push(answer))
    expect(answers).toEqual([{}])
    expect(failures).toEqual([[`NUI callback ${FromPage.Event}`, boom]])
  })

  it('still hands the message over when the answer to the page fails', () => {
    const { callbacks } = registered()
    const handled: string[] = []
    registerNuiCallbacks((type) => { handled.push(type) }, onFailure)
    callbacks.get(FromPage.Ready)?.({}, () => { throw new Error('closed') })
    expect(handled).toEqual([FromPage.Ready])
    expect(failures.length).toBe(1)
  })

  it('does not wait for a timer or a promise to register', () => {
    const { callbacks } = registered()
    registerNuiCallbacks(() => undefined, onFailure)
    expect(callbacks.size).toBe(Object.values(FromPage).length)
    expect(UiMode.Idle).toBeTypeOf('string')
  })
})
