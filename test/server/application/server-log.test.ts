import { describe, expect, it } from 'vitest'
import { prefixBlock } from '../../../src/server/application/server-log'
import { createServerHarness, LOG_PREFIX, PLAYER } from './server-harness'

const LOCALE_CONVAR = 'omk_ui_locale'
const ONE_MINUTE_TWO_SECONDS_FIVE_MILLISECONDS = 62_005

describe('server log: translation', () => {
  it('speaks french when the locale convar is absent', () => {
    expect(createServerHarness().context.log.translate('log.word.yes')).toBe('oui')
  })

  it('follows the locale convar every time it is read', () => {
    const { ports, context } = createServerHarness()
    ports.convars.set(LOCALE_CONVAR, 'en')
    expect(context.log.translate('log.word.yes')).toBe('yes')
    ports.convars.set(LOCALE_CONVAR, 'fr')
    expect(context.log.translate('log.word.yes')).toBe('oui')
  })

  it('falls back to english, then to the key itself', () => {
    const { ports, context } = createServerHarness()
    ports.convars.set(LOCALE_CONVAR, 'de')
    expect(context.log.translate('log.word.no')).toBe('no')
    ports.locales.setBundle('en', null)
    expect(context.log.translate('log.word.no')).toBe('log.word.no')
  })

  it('keeps a message the locale lacks in english', () => {
    const { ports, context } = createServerHarness()
    ports.locales.setBundle('fr', { language: 'fr', messages: { 'log.word.yes': 'oui' } })
    expect(context.log.translate('log.word.no')).toBe('no')
  })

  it('fills the placeholders and leaves an unknown one visible', () => {
    const { context } = createServerHarness()
    expect(context.log.translate('log.command.unknownPlayer', { player: 7 })).toBe('Joueur 7 introuvable')
    expect(context.log.translate('log.command.unknownPlayer', { other: 7 })).toBe('Joueur {player} introuvable')
  })
})

describe('server log: console lines', () => {
  it('prefixes a plain line', () => {
    const { ports, context } = createServerHarness()
    context.log.printLine('hello')
    expect(ports.console.lines).toStrictEqual([`${LOG_PREFIX} hello`])
  })

  it('stamps a server line with the elapsed game time', () => {
    const { ports, context } = createServerHarness()
    ports.clock.advance(ONE_MINUTE_TWO_SECONDS_FIVE_MILLISECONDS - ports.clock.now())
    context.log.printStamped('hello')
    expect(ports.console.lines).toStrictEqual([`${LOG_PREFIX} 01:02.005 · hello`])
  })

  it('stamps a player line with the player', () => {
    const { ports, context } = createServerHarness()
    context.log.printPlayer(PLAYER, 'hello')
    expect(ports.console.lines).toStrictEqual([`${LOG_PREFIX} 01:00.000 · joueur ${PLAYER} · hello`])
  })

  it('prefixes only the first line of a block', () => {
    expect(prefixBlock(['first', 'second'])).toStrictEqual([`${LOG_PREFIX} first`, 'second'])
    expect(prefixBlock([])).toStrictEqual([])
  })
})
