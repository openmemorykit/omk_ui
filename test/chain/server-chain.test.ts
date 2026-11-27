import { NotificationTone } from '@openmemorykit/ui/contract'
import { describe, expect, it } from 'vitest'
import french from '../../omk_ui/locales/fr.json'
import { ASK_OWNER } from '../../src/client/application/demos/demo-catalog'
import { PAGE_SNAPSHOT_WAIT_MS } from '../../src/client/application/snapshot'
import { FromPage } from '../../src/protocol/from-page'
import { Intent } from '../../src/protocol/intents'
import { UiMode } from '../../src/protocol/page-vocabulary'
import { ToPage } from '../../src/protocol/to-page'
import { OmkSubcommand } from '../../src/server/application/omk-subcommand'
import { SNAPSHOT_TIMEOUT_MS } from '../../src/server/application/snapshot-requests'
import { DemoName } from '../../src/shared/net/net-events'
import { AskOutcome } from '../../src/shared/report/report-payloads'
import { ReportKind } from '../../src/shared/report/report-kind'
import { CHAIN_PLAYER, createChain, type Chain } from './chain-harness'

const PLAYER = String(CHAIN_PLAYER)
const UNKNOWN_MARK = '?'
const NOTIFY_TEXT = 'Bonjour'
const QUESTION = 'Le panneau est-il lisible ?'
const SERVER_OWNER = 'omk_ui'
const OPEN_STACK_LINE = /^pile \(1, commande \d+ appliquée\)/
const TRACE_ON = 'on'
const INTENT_REPEAT = 2
const PRESS_AND_RELEASE = 2

function frenchText(key: keyof typeof french, values: Readonly<Record<string, string>> = {}): string {
  return Object.entries(values).reduce((line, [name, value]) => line.replace(`{${name}}`, value), french[key])
}

function tracedChain(): Chain {
  const chain = createChain()
  chain.command(OmkSubcommand.Trace, TRACE_ON, PLAYER)
  return chain
}

function listOpenedChain(): Chain {
  const chain = tracedChain()
  chain.command(OmkSubcommand.Demo, PLAYER, DemoName.List)
  return chain
}

function withoutPrefix(lines: readonly string[]): readonly string[] {
  return lines.map((line) => line.replace(/^\[omk_ui\] /, ''))
}

describe('server kit linked to the client kit and the page', () => {
  it('turns the journal on and prints the client lines on the server console', () => {
    const chain = listOpenedChain()
    const modeLine = frenchText('log.report.modeChanged', { details: `from=${UiMode.Idle}, to=${UiMode.Panels}` })
    expect(chain.server.console.lines.some((line) => line.endsWith(modeLine))).toBe(true)
  })

  it('prints a complete debug snapshot, page included, without an unknown value', () => {
    const chain = listOpenedChain()
    const lines = withoutPrefix(chain.command(OmkSubcommand.Debug, PLAYER))
    expect(lines.filter((line) => line.includes(UNKNOWN_MARK))).toStrictEqual([])
    expect(lines.some((line) => OPEN_STACK_LINE.test(line))).toBe(true)
    expect(lines).not.toContain(frenchText('log.debug.pageMissing'))
  })

  it('sends a debug snapshot without the page once the client waited for it', () => {
    const chain = listOpenedChain()
    chain.holdPageMessages(FromPage.Snapshot)
    chain.command(OmkSubcommand.Debug, PLAYER)
    chain.client.clock.advance(PAGE_SNAPSHOT_WAIT_MS + 1)
    chain.kit.expireSnapshot()
    chain.settle()
    expect(withoutPrefix(chain.replyLines)).toContain(frenchText('log.debug.pageMissing'))
  })

  it('answers "no reply" once the server waited three seconds for the client', () => {
    const chain = listOpenedChain()
    chain.holdReports()
    chain.command(OmkSubcommand.Debug, PLAYER)
    chain.server.clock.advance(SNAPSHOT_TIMEOUT_MS + 1)
    chain.serverKit.flushExpired()
    expect(withoutPrefix(chain.replyLines)).toContain(frenchText('log.debug.noReply', { player: PLAYER }))
  })

  it('shows a console notification on the page under the omk_ui owner', () => {
    const chain = createChain()
    chain.command(OmkSubcommand.Notify, PLAYER, NotificationTone.Info, NOTIFY_TEXT)
    const { visible, waiting } = chain.store.state().toasts
    expect([...visible, ...waiting].map((toast) => toast.owned.owner)).toStrictEqual([SERVER_OWNER])
  })

  it('moves the page with console intents and closes everything', () => {
    const chain = listOpenedChain()
    chain.command(OmkSubcommand.Intent, PLAYER, Intent.Down, String(INTENT_REPEAT))
    expect(chain.client.nui.sentOfType(ToPage.Intent)).toHaveLength(INTENT_REPEAT * PRESS_AND_RELEASE)
    chain.command(OmkSubcommand.Close, PLAYER)
    expect(chain.client.nui.sentOfType(ToPage.CloseAll)).toHaveLength(1)
    expect(chain.store.state().mode).toBe(UiMode.Idle)
  })

  it('asks a question on the page and prints the answer from the journal', () => {
    const chain = tracedChain()
    chain.command(OmkSubcommand.Ask, PLAYER, QUESTION)
    expect(chain.client.nui.sentOfType(ToPage.ShowConfirm).map((message) => message.confirm.owner)).toStrictEqual([ASK_OWNER])
    chain.command(OmkSubcommand.Intent, PLAYER, Intent.Confirm)
    const answers = chain.reportsToServer.filter((report) => report.kind === ReportKind.ConfirmAsked)
    expect(answers.map((report) => report.data)).toMatchObject([{ outcome: AskOutcome.Confirmed }])
    expect(chain.client.replies.attempts).toStrictEqual([])
  })
})
