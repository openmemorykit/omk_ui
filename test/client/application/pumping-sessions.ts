import { INITIAL_CLIENT_SESSION, type ClientSession } from '../../../src/client/application/session-state'
import { EMPTY_REGISTRY } from '../../../src/client/domain/owner-registry'
import { GesturePhase } from '../../../src/client/domain/open-gesture'
import { startEscapeGuard, startPadGuard, VIEW_CONTROL } from '../../../src/client/domain/release-guard'
import { UiMode } from '../../../src/protocol/page-vocabulary'
import { HOLD_PROMPT } from '../../fixtures/surfaces'
import { FixtureOwner } from '../../fixtures/owned'

const STARTED_AT = 500

export const PUMPING_SESSIONS: readonly (readonly [string, ClientSession])[] = [
  ['a radial is open', { ...INITIAL_CLIENT_SESSION, mode: UiMode.Radial }],
  ['the page waits for a panel', { ...INITIAL_CLIENT_SESSION, mode: UiMode.Waiting }],
  ['panels are open', { ...INITIAL_CLIENT_SESSION, mode: UiMode.Panels }],
  ['the pad gesture is held', { ...INITIAL_CLIENT_SESSION, gesture: { phase: GesturePhase.Pressed, startedAt: STARTED_AT } }],
  ['the release guard holds the pad controls', { ...INITIAL_CLIENT_SESSION, guard: startPadGuard(VIEW_CONTROL, STARTED_AT) }],
  ['the end of Escape is awaited', { ...INITIAL_CLIENT_SESSION, guard: startEscapeGuard(STARTED_AT) }],
  ['a prompt is shown', { ...INITIAL_CLIENT_SESSION, registry: { ...EMPTY_REGISTRY, prompts: [{ owner: FixtureOwner.Garage, prompt: HOLD_PROMPT }] } }],
]
