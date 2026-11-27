import { describe, expect, it } from 'vitest'
import english from '../../../omk_ui/locales/en.json'
import french from '../../../omk_ui/locales/fr.json'
import { OmkSubcommand } from '../../../src/server/application/omk-subcommand'
import { createServerKit } from '../../../src/server/application/server-kit'
import { CommandKind } from '../../../src/shared/net/net-events'
import { LocaleWarningKind } from '../../../src/shared/locales/locale-warning'
import { createServerPortsFake, type ServerPortsFake } from '../fakes/server-ports-fake'
import { AFTER_TIMEOUT_MS, ARTIFACT_CONVAR, collectReplies, KIT_VERSION, PLAYER, START } from './server-harness'

const MISSING_SUBCOMMAND = 'nothing'
const BROKEN_FILE = 'locales/de.json'
const ADMIN_PERMISSION = 'omk_ui.admin'

function startedPorts(): ServerPortsFake {
  const ports = createServerPortsFake([PLAYER], START)
  ports.locales.setBundle('fr', { language: 'fr', messages: french })
  ports.locales.setBundle('en', { language: 'en', messages: english })
  ports.convars.set('version', ARTIFACT_CONVAR)
  return ports
}

function defaultLanguageLine(key: keyof typeof french, values: Readonly<Record<string, string>>): string {
  return Object.entries(values).reduce((line, [name, value]) => line.replace(`{${name}}`, value), french[key])
}

describe('createServerKit', () => {
  it('answers an unknown subcommand with its name and the list of subcommands', () => {
    const kit = createServerKit(startedPorts(), KIT_VERSION)
    const { lines, reply } = collectReplies()
    kit.unknownSubcommand(MISSING_SUBCOMMAND, reply)
    expect(lines.join('\n')).toContain(MISSING_SUBCOMMAND)
    expect(Object.values(OmkSubcommand).every((subcommand) => lines.join('\n').includes(subcommand))).toBe(true)
  })

  it('answers a player without the permission with one line naming it', () => {
    const kit = createServerKit(startedPorts(), KIT_VERSION)
    const { lines, reply } = collectReplies()
    kit.denied(PLAYER, reply)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain(ADMIN_PERMISSION)
  })

  it('answers "no reply" once the snapshot asked by debug has waited three seconds', () => {
    const ports = startedPorts()
    const kit = createServerKit(ports, KIT_VERSION)
    const { lines, reply } = collectReplies()
    kit.command(OmkSubcommand.Debug, [String(PLAYER)], reply)
    expect(ports.clients.sentTo(PLAYER).map((command) => command.kind)).toStrictEqual([CommandKind.Snapshot])
    kit.flushExpired()
    const noReply = defaultLanguageLine('log.debug.noReply', { player: String(PLAYER) })
    expect([...lines, ...ports.console.lines].some((line) => line.includes(noReply))).toBe(false)
    ports.clock.advance(AFTER_TIMEOUT_MS)
    kit.flushExpired()
    expect([...lines, ...ports.console.lines].filter((line) => line.includes(noReply))).toHaveLength(1)
  })

  it('prints the language warnings, translated, after the next entry point and not before', () => {
    const ports = startedPorts()
    const kit = createServerKit(ports, KIT_VERSION)
    kit.localeWarning({ kind: LocaleWarningKind.FileMalformed, file: BROKEN_FILE })
    const warning = defaultLanguageLine('log.locale.fileMalformed', { file: BROKEN_FILE })
    expect(ports.console.lines.some((line) => line.includes(warning))).toBe(false)
    kit.started()
    expect(ports.console.lines.filter((line) => line.includes(warning))).toHaveLength(1)
    kit.playerDropped(PLAYER)
    expect(ports.console.lines.filter((line) => line.includes(warning))).toHaveLength(1)
  })

  it('sends a server notification to the player through the client channel', () => {
    const ports = startedPorts()
    const kit = createServerKit(ports, KIT_VERSION)
    kit.notifyExport(PLAYER, { version: 1, tone: 'info', title: KIT_VERSION }, 'garage')
    expect(ports.clients.sentTo(PLAYER).map((command) => command.kind)).toStrictEqual([CommandKind.Notify])
  })
})
