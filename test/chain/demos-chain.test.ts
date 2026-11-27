import { describe, expect, it } from 'vitest'
import { DEMO_OWNERS } from '../../src/client/application/demos/demo-catalog'
import { Intent } from '../../src/protocol/intents'
import { UiMode } from '../../src/protocol/page-vocabulary'
import { ToPage } from '../../src/protocol/to-page'
import { OmkSubcommand } from '../../src/server/application/omk-subcommand'
import { DemoName } from '../../src/shared/net/net-events'
import { ReportKind } from '../../src/shared/report/report-kind'
import { CHAIN_PLAYER, createChain, type Chain } from './chain-harness'

const PLAYER = String(CHAIN_PLAYER)
const PROMPT_HOLD_DONE_MS = 2000
const TOAST_COUNT = 6
const ONE_REPLY = 1
const NO_REPLY = 0
const RADIAL_SECTOR_COUNT = 5

type DemoAction = (chain: Chain) => void

function sendIntent(intent: Intent): DemoAction {
  return (chain) => void chain.command(OmkSubcommand.Intent, PLAYER, intent)
}

function selectFirstRadialSector(chain: Chain): void {
  chain.kit.radialPress()
  chain.settle()
  chain.kit.radialRelease()
  chain.settle()
  expect(chain.store.state().mode).toBe(UiMode.Radial)
  sendIntent(Intent.Confirm)(chain)
}

function holdThePrompt(chain: Chain): void {
  chain.kit.interactPress()
  chain.settle()
  chain.client.clock.advance(PROMPT_HOLD_DONE_MS)
  chain.kit.pumpFrame()
  chain.kit.interactRelease()
  chain.settle()
}

const DEMO_ACTIONS: readonly (readonly [DemoName, DemoAction, number, number])[] = [
  [DemoName.Radial, selectFirstRadialSector, ONE_REPLY, ONE_REPLY],
  [DemoName.List, sendIntent(Intent.Confirm), ONE_REPLY, ONE_REPLY],
  [DemoName.LongList, sendIntent(Intent.Confirm), ONE_REPLY, ONE_REPLY],
  [DemoName.Form, sendIntent(Intent.Back), ONE_REPLY, ONE_REPLY],
  [DemoName.Confirm, sendIntent(Intent.Back), ONE_REPLY, ONE_REPLY],
  [DemoName.Keyboard, sendIntent(Intent.Back), ONE_REPLY, ONE_REPLY],
  [DemoName.Toasts, () => undefined, NO_REPLY, NO_REPLY],
  [DemoName.Prompt, holdThePrompt, ONE_REPLY, NO_REPLY],
]

function demoChain(demo: DemoName): Chain {
  const chain = createChain()
  chain.command(OmkSubcommand.Trace, 'on', PLAYER)
  chain.command(OmkSubcommand.Demo, PLAYER, demo)
  return chain
}

function demoReplyReports(chain: Chain): readonly object[] {
  return chain.reportsToServer.filter((report) => report.kind === ReportKind.DemoReply)
}

describe('client, page and server chain on the eight demos', () => {
  it('boots the page once after its ready, with the session token on every page message', () => {
    const chain = createChain()
    expect(chain.client.nui.boots).toHaveLength(1)
    expect(chain.reportsToServer.filter((report) => report.kind === ReportKind.ForgedCall)).toStrictEqual([])
  })

  it.each(DEMO_ACTIONS)('plays demo %s and answers its replies in the journal, never through a resource', (demo, act, journalReplies, pageReplies) => {
    const chain = demoChain(demo)
    act(chain)
    expect(chain.client.replies.attempts).toStrictEqual([])
    expect(chain.pageReplies.every((reply) => DEMO_OWNERS.has(reply.owner))).toBe(true)
    expect(chain.pageReplies).toHaveLength(pageReplies)
    expect(demoReplyReports(chain)).toHaveLength(journalReplies)
    expect(chain.reportsToServer.filter((report) => report.kind === ReportKind.ReplyUndelivered)).toStrictEqual([])
    expect(chain.reportsToServer.filter((report) => report.kind === ReportKind.ContractRefused || report.kind === ReportKind.CallLimited)).toStrictEqual([])
  })

  it('opens the whitelist list of the radial demo when a sector is selected', () => {
    const chain = demoChain(DemoName.Radial)
    expect(chain.client.nui.sentOfType(ToPage.RadialEntries).at(-1)?.entries).toHaveLength(RADIAL_SECTOR_COUNT)
    selectFirstRadialSector(chain)
    expect(chain.client.nui.sentOfType(ToPage.OpenPanel)).toHaveLength(1)
    expect(chain.store.state().mode).toBe(UiMode.Panels)
  })

  it('shows every toast of the toasts demo on the page', () => {
    const chain = demoChain(DemoName.Toasts)
    const toasts = chain.store.state().toasts
    expect(toasts.visible.length + toasts.waiting.length + toasts.dropped).toBe(TOAST_COUNT)
  })
})
