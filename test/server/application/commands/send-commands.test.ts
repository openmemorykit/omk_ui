import { NotificationTone } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import { OmkSubcommand } from '../../../../src/server/application/omk-subcommand'
import { ALL_CLIENTS } from '../../../../src/server/application/ports'
import { Intent } from '../../../../src/protocol/intents'
import { ASK_TEXT_MAX_LENGTH, CommandKind, DemoName, INTENT_COUNT_MAX } from '../../../../src/shared/net/net-events'
import { createServerHarness, LOG_PREFIX, PLAYER, run } from './command-harness'

const TITLE_TOO_LONG = 300
const prefixed = (text: string): string[] => [`${LOG_PREFIX} ${text}`]

describe('omk_ui demo', () => {
  it.each(Object.values(DemoName))('opens the demo %s for the player', (demo) => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Demo, String(PLAYER), demo)).toStrictEqual(prefixed(`Démo ${demo} ouverte chez joueur ${PLAYER}`))
    expect(harness.ports.clients.sent).toStrictEqual([{ target: PLAYER, command: { kind: CommandKind.Demo, demo } }])
  })

  it.each([[[]], [[String(PLAYER)]], [[String(PLAYER), 'dance']], [[String(PLAYER), 'toString']], [['someone', 'radial']]])('lists the scenarios for %j', (args) => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Demo, ...args)).toStrictEqual(prefixed(`omk_ui demo <id> <scénario> · scénarios : ${Object.values(DemoName).join(', ')}`))
    expect(harness.ports.clients.sent).toStrictEqual([])
  })

  it('names a player who is not there', () => {
    expect(run(createServerHarness(), OmkSubcommand.Demo, '99', 'radial')).toStrictEqual(prefixed('Joueur 99 introuvable'))
  })
})

describe('omk_ui intent', () => {
  it('sends the intent once by default, with the count as a number', () => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Intent, String(PLAYER), Intent.Confirm)).toStrictEqual(prefixed(`Intention confirm envoyée 1 fois à joueur ${PLAYER}`))
    expect(harness.ports.clients.sent).toStrictEqual([{ target: PLAYER, command: { kind: CommandKind.Intent, intent: Intent.Confirm, count: 1 } }])
  })

  it.each([1, INTENT_COUNT_MAX - 1, INTENT_COUNT_MAX])('sends it %i times', (count) => {
    const harness = createServerHarness()
    run(harness, OmkSubcommand.Intent, String(PLAYER), Intent.TabNext, String(count))
    expect(harness.ports.clients.sent).toStrictEqual([{ target: PLAYER, command: { kind: CommandKind.Intent, intent: Intent.TabNext, count } }])
  })

  it.each([['0'], [String(INTENT_COUNT_MAX + 1)], ['1.5'], ['-3'], ['x'], ['']])('shows the usage for n = "%s"', (count) => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Intent, String(PLAYER), Intent.Up, count)).toStrictEqual(prefixed('omk_ui intent <id> <intention> [n] · n de 1 à 50'))
    expect(harness.ports.clients.sent).toStrictEqual([])
  })

  it.each([[[]], [[String(PLAYER)]], [[String(PLAYER), 'jump']], [[String(PLAYER), 'constructor']], [[String(PLAYER), Intent.Up, '2', 'more']]])('shows the usage for %j', (args) => {
    expect(run(createServerHarness(), OmkSubcommand.Intent, ...args)[0]).toContain('omk_ui intent <id> <intention> [n]')
  })

  it('names a player who is not there', () => {
    expect(run(createServerHarness(), OmkSubcommand.Intent, '99', Intent.Up)).toStrictEqual(prefixed('Joueur 99 introuvable'))
  })
})

describe('omk_ui close', () => {
  it('asks the client to close everything', () => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Close, String(PLAYER))).toStrictEqual(prefixed(`Fermeture de tout demandée chez joueur ${PLAYER}`))
    expect(harness.ports.clients.sent).toStrictEqual([{ target: PLAYER, command: { kind: CommandKind.Close } }])
  })

  it('names a player who is not there, and shows the usage without an id', () => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Close, '99')).toStrictEqual(prefixed('Joueur 99 introuvable'))
    expect(run(harness, OmkSubcommand.Close)).toStrictEqual(prefixed('omk_ui close <id>'))
  })
})

describe('omk_ui notify', () => {
  it('sends a test notification to one player', () => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Notify, String(PLAYER), 'success', 'Tout', 'va', 'bien')).toStrictEqual(prefixed(`Notification success envoyée à ${PLAYER}`))
    expect(harness.ports.clients.sent).toStrictEqual([
      { target: PLAYER, command: { kind: CommandKind.Notify, notification: { version: 1, tone: NotificationTone.Success, title: 'Tout va bien' } } },
    ])
  })

  it('sends it to everybody', () => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Notify, 'all', 'info', 'Salut')).toStrictEqual(prefixed('Notification info envoyée à tous les joueurs'))
    expect(harness.ports.clients.sent.map((entry) => entry.target)).toStrictEqual([ALL_CLIENTS])
  })

  it('says why the contract refuses a title that is too long', () => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Notify, 'all', 'info', 'x'.repeat(TITLE_TOO_LONG))).toStrictEqual(prefixed('Notification refusée : title'))
    expect(harness.ports.clients.sent).toStrictEqual([])
  })

  it.each([[[]], [['all']], [['all', 'info']], [['all', 'loud', 'Salut']], [['someone', 'info', 'Salut']]])('lists the tones for %j', (args) => {
    expect(run(createServerHarness(), OmkSubcommand.Notify, ...args)).toStrictEqual(prefixed('omk_ui notify <id|all> <ton> <texte> · tons : info, success, warning, error'))
  })

  it('names a player who is not there', () => {
    expect(run(createServerHarness(), OmkSubcommand.Notify, '99', 'info', 'Salut')).toStrictEqual(prefixed('Joueur 99 introuvable'))
  })
})

describe('omk_ui ask', () => {
  it('asks the question of the session to a player whose journal is on, and numbers it', () => {
    const harness = createServerHarness()
    harness.context.traces.activate(PLAYER)
    expect(run(harness, OmkSubcommand.Ask, String(PLAYER), 'Tu', 'vois', 'le', 'menu ?')).toStrictEqual(prefixed(`Question 1 posée à joueur ${PLAYER} : la réponse arrive dans le journal`))
    run(harness, OmkSubcommand.Ask, String(PLAYER), 'Encore ?')
    expect(harness.ports.clients.sent).toStrictEqual([
      { target: PLAYER, command: { kind: CommandKind.Ask, askId: 1, text: 'Tu vois le menu ?' } },
      { target: PLAYER, command: { kind: CommandKind.Ask, askId: 2, text: 'Encore ?' } },
    ])
  })

  it('asks nothing while the journal is cut, because the answer goes through it', () => {
    const harness = createServerHarness()
    expect(run(harness, OmkSubcommand.Ask, String(PLAYER), 'Tu vois ?')).toStrictEqual(prefixed(`Journal coupé pour joueur ${PLAYER} : la réponse passe par lui (omk_ui trace on ${PLAYER})`))
    expect(harness.ports.clients.sent).toStrictEqual([])
  })

  it('turns the journal on for the asked player right before the question when everybody is traced', () => {
    const harness = createServerHarness()
    harness.context.traces.activateAll()
    run(harness, OmkSubcommand.Ask, String(PLAYER), 'Tu vois ?')
    expect(harness.ports.clients.sent).toStrictEqual([
      { target: PLAYER, command: { kind: CommandKind.Trace, active: true } },
      { target: PLAYER, command: { kind: CommandKind.Ask, askId: 1, text: 'Tu vois ?' } },
    ])
  })

  it('does not touch the journal of a player traced one by one', () => {
    const harness = createServerHarness()
    harness.context.traces.activate(PLAYER)
    run(harness, OmkSubcommand.Ask, String(PLAYER), 'Tu vois ?')
    expect(harness.ports.clients.sent.map(({ command }) => command.kind)).toStrictEqual([CommandKind.Ask])
  })

  it('accepts a question of the longest length, and refuses a longer one', () => {
    const harness = createServerHarness()
    harness.context.traces.activateAll()
    run(harness, OmkSubcommand.Ask, String(PLAYER), 'x'.repeat(ASK_TEXT_MAX_LENGTH))
    expect(harness.ports.clients.sent.filter(({ command }) => command.kind === CommandKind.Ask)).toHaveLength(1)
    const sentBefore = harness.ports.clients.sent.length
    expect(run(harness, OmkSubcommand.Ask, String(PLAYER), 'x'.repeat(ASK_TEXT_MAX_LENGTH + 1))).toStrictEqual(prefixed('omk_ui ask <id> <question>'))
    expect(harness.ports.clients.sent).toHaveLength(sentBefore)
  })

  it.each([[[]], [[String(PLAYER)]], [['someone', 'Tu vois ?']]])('shows the usage for %j', (args) => {
    expect(run(createServerHarness(), OmkSubcommand.Ask, ...args)).toStrictEqual(prefixed('omk_ui ask <id> <question>'))
  })

  it('names a player who is not there', () => {
    expect(run(createServerHarness(), OmkSubcommand.Ask, '99', 'Tu vois ?')).toStrictEqual(prefixed('Joueur 99 introuvable'))
  })
})
