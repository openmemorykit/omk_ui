import { installNatives, type NativeRecorder } from '@openmemorykit/core/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FailureHandler } from '../../../src/shared/guarded-call'
import { BindingCommand } from '../../../src/client/application/boot-message'
import { KeyCommand, registerKeyMappings, type KeyMappingOptions } from '../../../src/client/infrastructure/key-mapping'

const SUGGESTION_REMOVAL_DELAY_MS = 500
const DEFAULT_KEY_INDEX = 3
const RESTRICTED_INDEX = 2
const RADIAL_COMMAND = '+omk_ui_radial'
const GLYPHS_COMMAND = 'omk_glyphs'
const RADIAL_DESCRIPTION = 'Open the radial menu (omk_ui)'
const INTERACT_DESCRIPTION = 'Interact with a prompt (omk_ui)'

type Handler = (source: number, args: string[]) => void

let natives: NativeRecorder
let handlers: Map<string, Handler>

function install(): void {
  handlers = new Map()
  natives = installNatives({
    RegisterCommand: (name: string, handler: Handler) => handlers.set(name, handler),
    RegisterKeyMapping: () => undefined,
    TriggerEvent: () => undefined,
  })
}

function options(overrides: Partial<KeyMappingOptions> = {}): KeyMappingOptions {
  return {
    radial: { description: RADIAL_DESCRIPTION, onPress: vi.fn(), onRelease: vi.fn() },
    interact: { description: INTERACT_DESCRIPTION, onPress: vi.fn(), onRelease: vi.fn() },
    glyphs: { onCommand: vi.fn() },
    onFailure: vi.fn(),
    ...overrides,
  }
}

function fire(name: string, args: string[] = []): void {
  handlers.get(name)?.(0, args)
}

beforeEach(() => {
  vi.useFakeTimers()
  install()
})

afterEach(() => {
  natives.restore()
  vi.useRealTimers()
})

describe('key mapping', () => {
  it('binds omk_ui_radial to F1 and omk_ui_interact to E on the keyboard, with the translated descriptions', () => {
    registerKeyMappings(options())
    expect(natives.callsOf('RegisterKeyMapping')).toEqual([
      ['+omk_ui_radial', RADIAL_DESCRIPTION, 'keyboard', 'F1'],
      ['+omk_ui_interact', INTERACT_DESCRIPTION, 'keyboard', 'E'],
    ])
  })

  it('takes the default key from the binding when the config changes it', () => {
    registerKeyMappings(options({ radial: { description: RADIAL_DESCRIPTION, defaultKey: 'F5', onPress: vi.fn(), onRelease: vi.fn() } }))
    expect(natives.callsOf('RegisterKeyMapping')[0]?.[DEFAULT_KEY_INDEX]).toBe('F5')
  })

  it('registers a + and a - command per binding that call the press and release handlers', () => {
    const settings = options()
    registerKeyMappings(settings)
    fire('+omk_ui_radial')
    fire('-omk_ui_radial')
    fire('+omk_ui_interact')
    fire('-omk_ui_interact')
    expect(settings.radial.onPress).toHaveBeenCalledTimes(1)
    expect(settings.radial.onRelease).toHaveBeenCalledTimes(1)
    expect(settings.interact.onPress).toHaveBeenCalledTimes(1)
    expect(settings.interact.onRelease).toHaveBeenCalledTimes(1)
  })

  it('removes the /+ and /- chat suggestions after the registration delay', () => {
    registerKeyMappings(options())
    expect(natives.callsOf('TriggerEvent')).toHaveLength(0)
    vi.advanceTimersByTime(SUGGESTION_REMOVAL_DELAY_MS)
    expect(natives.callsOf('TriggerEvent')).toEqual([
      ['chat:removeSuggestion', '/+omk_ui_radial'],
      ['chat:removeSuggestion', '/-omk_ui_radial'],
      ['chat:removeSuggestion', '/+omk_ui_interact'],
      ['chat:removeSuggestion', '/-omk_ui_interact'],
    ])
  })

  it('registers no ~! binding and no PAD_DIGITALBUTTON mapping', () => {
    registerKeyMappings(options())
    const mappings = natives.callsOf('RegisterKeyMapping')
    expect(mappings.map(([, , mapper]) => mapper)).toEqual(['keyboard', 'keyboard'])
    expect(mappings.flat().filter((value) => typeof value === 'string' && (value.startsWith('~!') || value.includes('PAD_DIGITALBUTTON')))).toEqual([])
    expect(natives.callsOf('RegisterCommand').filter(([name]) => String(name).startsWith('~!'))).toEqual([])
  })

  it('registers the player command omk_glyphs and hands it the typed arguments', () => {
    const onCommand = vi.fn()
    registerKeyMappings(options({ glyphs: { onCommand } }))
    fire('omk_glyphs', ['playstation'])
    expect(onCommand).toHaveBeenCalledWith(['playstation'])
    expect(natives.callsOf('RegisterCommand').find(([name]) => name === GLYPHS_COMMAND)?.[RESTRICTED_INDEX]).toBe(false)
  })

  it('adds the omk_glyphs chat suggestion only when its help text is given', () => {
    registerKeyMappings(options({ glyphs: { onCommand: vi.fn(), help: 'Change the glyph set', argumentHelp: 'The controller family' } }))
    expect(natives.callsOf('TriggerEvent')).toEqual([['chat:addSuggestion', '/omk_glyphs', 'Change the glyph set', [{ name: 'xbox|playstation', help: 'The controller family' }]]])
  })

  it('hands an empty argument list to omk_glyphs when the command arrives without arguments', () => {
    const onCommand = vi.fn()
    registerKeyMappings(options({ glyphs: { onCommand } }))
    handlers.get('omk_glyphs')?.(0, undefined as unknown as string[])
    expect(onCommand).toHaveBeenCalledWith([])
  })

  it('keeps an exception from a handler out of the command and reports it', () => {
    const failure = new Error('handler broke')
    const onFailure = vi.fn<FailureHandler>()
    registerKeyMappings(options({ radial: { description: RADIAL_DESCRIPTION, onPress: () => { throw failure }, onRelease: vi.fn() }, glyphs: { onCommand: () => { throw failure } }, onFailure }))
    expect(() => {
      fire('+omk_ui_radial')
      fire('omk_glyphs', [])
    }).not.toThrow()
    expect(onFailure.mock.calls).toEqual([['keyMapping.omk_ui_radial.press', failure], ['keyMapping.omk_glyphs', failure]])
  })

  it('keeps a registration failure out of startup and still registers the other commands', () => {
    natives.restore()
    handlers = new Map()
    natives = installNatives({
      RegisterCommand: (name: string, handler: Handler) => {
        if (name === RADIAL_COMMAND) throw new Error('register failed')
        handlers.set(name, handler)
      },
      RegisterKeyMapping: () => undefined,
      TriggerEvent: () => undefined,
    })
    const onFailure = vi.fn<FailureHandler>()
    expect(() => registerKeyMappings(options({ onFailure }))).not.toThrow()
    expect(onFailure.mock.calls.map(([source]) => source)).toEqual(['keyMapping.omk_ui_radial'])
    expect(handlers.has('+omk_ui_interact')).toBe(true)
    expect(handlers.has('omk_glyphs')).toBe(true)
  })

  it('names its hold commands as the application binding commands without the plus sign', () => {
    expect([`+${KeyCommand.Radial}`, `+${KeyCommand.Interact}`]).toEqual([BindingCommand.Radial, BindingCommand.Interact])
  })
})
