import { registerHoldCommand, KeyMapper } from '@openmemorykit/core/client'
import { GlyphSet } from '../../protocol/page-vocabulary'
import type { FailureReporter } from './native-guard'

export const KeyCommand = { Radial: 'omk_ui_radial', Interact: 'omk_ui_interact', Glyphs: 'omk_glyphs' } as const
export const DEFAULT_RADIAL_KEY = 'F1'
export const DEFAULT_INTERACT_KEY = 'E'

const CHAT_SUGGESTION_EVENT = 'chat:addSuggestion'

export interface HoldBinding {
  readonly description: string
  readonly defaultKey?: string
  readonly onPress: () => void
  readonly onRelease: () => void
}

export interface GlyphsCommand {
  readonly onCommand: (args: readonly string[]) => void
  readonly help?: string
  readonly argumentHelp?: string
}

export interface KeyMappingOptions {
  readonly radial: HoldBinding
  readonly interact: HoldBinding
  readonly glyphs: GlyphsCommand
  readonly onFailure: FailureReporter
}

function shielded(onFailure: FailureReporter, source: string, handler: () => void): () => void {
  return () => {
    try {
      handler()
    } catch (error) {
      try {
        onFailure(source, error)
      } catch {
        return
      }
    }
  }
}

function registerBinding(command: string, binding: HoldBinding, defaultKey: string, onFailure: FailureReporter): void {
  registerHoldCommand({
    name: command,
    description: binding.description,
    mapper: KeyMapper.Keyboard,
    defaultKey: binding.defaultKey ?? defaultKey,
    onPress: shielded(onFailure, `keyMapping.${command}.press`, binding.onPress),
    onRelease: shielded(onFailure, `keyMapping.${command}.release`, binding.onRelease),
  })
}

function registerGlyphsCommand(glyphs: GlyphsCommand, onFailure: FailureReporter): void {
  RegisterCommand(KeyCommand.Glyphs, (_source: number, args: unknown) => {
    shielded(onFailure, `keyMapping.${KeyCommand.Glyphs}`, () => glyphs.onCommand(Array.isArray(args) ? args.map(String) : []))()
  }, false)
  if (glyphs.help === undefined) return
  const options = Object.values(GlyphSet).map((glyphSet) => glyphSet.toLowerCase()).join('|')
  TriggerEvent(CHAT_SUGGESTION_EVENT, `/${KeyCommand.Glyphs}`, glyphs.help, [{ name: options, help: glyphs.argumentHelp ?? '' }])
}

export function registerKeyMappings(options: KeyMappingOptions): void {
  shielded(options.onFailure, `keyMapping.${KeyCommand.Radial}`, () => registerBinding(KeyCommand.Radial, options.radial, DEFAULT_RADIAL_KEY, options.onFailure))()
  shielded(options.onFailure, `keyMapping.${KeyCommand.Interact}`, () => registerBinding(KeyCommand.Interact, options.interact, DEFAULT_INTERACT_KEY, options.onFailure))()
  shielded(options.onFailure, 'keyMapping.glyphsCommand', () => registerGlyphsCommand(options.glyphs, options.onFailure))()
}
