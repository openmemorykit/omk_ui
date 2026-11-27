import { STACK_MAX_DEPTH } from '@openmemorykit/ui/contract'
import { toPageConfirm, toPagePanel, toPagePrompt, type OwnedConfirm, type OwnedPrompt } from '../../protocol/owned'
import { GlyphSet } from '../../protocol/page-vocabulary'
import { ToPage, type BindingLabels, type LocaleBundle, type ToPageMessageOf } from '../../protocol/to-page'
import { radialOrder, visiblePrompt, type RegistryState } from '../domain/owner-registry'
import { FALLBACK_LOCALE, LOCALE_CONVAR } from './glyph-set'
import type { ClientPorts } from './ports'

export const BindingCommand = { Radial: '+omk_ui_radial', Interact: '+omk_ui_interact' } as const
export const DEFAULT_GLYPH_SET = GlyphSet.Xbox
const LOCALE_NAME_PATTERN = /^[a-z]{2}(?:-[A-Z]{2})?$/

export type BootMessage = ToPageMessageOf<typeof ToPage.Boot>

export function requestedLocale(ports: ClientPorts): string {
  const requested = ports.convars.read(LOCALE_CONVAR)
  return requested !== null && LOCALE_NAME_PATTERN.test(requested) ? requested : FALLBACK_LOCALE
}

function bootLocale(ports: ClientPorts): LocaleBundle {
  return ports.locales.read(requestedLocale(ports)) ?? ports.locales.read(FALLBACK_LOCALE) ?? { language: FALLBACK_LOCALE, messages: {} }
}

export function bindingLabels(ports: ClientPorts): BindingLabels {
  return {
    radial: ports.controls.bindingLabel(BindingCommand.Radial),
    interact: ports.controls.bindingLabel(BindingCommand.Interact),
    pushToTalk: ports.controls.pushToTalkLabel(),
  }
}

export function currentGlyphSet(ports: ClientPorts): GlyphSet {
  return ports.glyphs.read() ?? DEFAULT_GLYPH_SET
}

function waitingConfirm(registry: RegistryState): OwnedConfirm | null {
  const newest = registry.confirms[registry.confirms.length - 1]
  return newest === undefined ? null : toPageConfirm(newest.owner, newest.confirm)
}

function shownPrompt(registry: RegistryState): OwnedPrompt | null {
  const shown = visiblePrompt(registry)
  return shown === null ? null : toPagePrompt(shown.owner, shown.prompt)
}

export function buildBootMessage(ports: ClientPorts, registry: RegistryState): BootMessage {
  return {
    type: ToPage.Boot,
    settings: ports.config.read().config.theme,
    locale: bootLocale(ports),
    glyphSet: currentGlyphSet(ports),
    bindings: bindingLabels(ports),
    radialEntries: radialOrder(registry),
    panels: registry.stack.slice(0, STACK_MAX_DEPTH).map(({ owner, panel }) => toPagePanel(owner, panel)),
    confirm: waitingConfirm(registry),
    prompt: shownPrompt(registry),
    commandSeq: registry.commandSeq,
  }
}
