import { describe, expect, it } from 'vitest'
import { pageSnapshot } from '../../../src/page/domain/page-snapshot'
import { FormStatus } from '../../../src/page/domain/form'
import { Intent } from '../../../src/protocol/intents'
import { FormField, KeyboardField, PageSnapshotField, SnapshotPanelField } from '../../../src/shared/report/snapshot-fields'
import { OWNED_ADD_PANEL, OWNED_LIST_PANEL } from '../../fixtures/owned'
import { press, run, withPanels } from './intent-engine/engine-helpers'
import { NOTE_MENU } from './intent-engine/handler-helpers'

const FIRST_SECTOR = 0
const NO_TOASTS = 0

describe('pageSnapshot', () => {
  it('lists the panels with their focus, the way the server reads them', () => {
    const snapshot = pageSnapshot(withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL]))
    expect(snapshot[PageSnapshotField.Panels]).toStrictEqual([
      { [SnapshotPanelField.Id]: OWNED_LIST_PANEL.panel.id, [SnapshotPanelField.Focus]: expect.any(String) as unknown },
      { [SnapshotPanelField.Id]: OWNED_ADD_PANEL.panel.id, [SnapshotPanelField.Focus]: expect.any(String) as unknown },
    ])
  })

  it('describes the form of the open panel without its values', () => {
    const snapshot = pageSnapshot(withPanels([OWNED_LIST_PANEL, OWNED_ADD_PANEL]))
    expect(snapshot[PageSnapshotField.Form]).toStrictEqual({
      [FormField.Panel]: OWNED_ADD_PANEL.panel.id,
      [FormField.State]: FormStatus.Editing,
      [FormField.Submission]: 0,
      [FormField.Errors]: 0,
    })
    expect(snapshot).not.toHaveProperty(PageSnapshotField.Keyboard)
  })

  it('describes the virtual keyboard by its layer and its length, never its text', () => {
    const typing = run(withPanels([NOTE_MENU]), [press(Intent.Confirm), press(Intent.Confirm)]).state
    const keyboard = pageSnapshot(typing)[PageSnapshotField.Keyboard]
    expect(keyboard).toStrictEqual({ [KeyboardField.Name]: 'keyboard', [KeyboardField.Layer]: 'letters', [KeyboardField.Length]: 1, [KeyboardField.Max]: expect.any(Number) as unknown })
  })

  it('has no panel, form or keyboard when nothing is open, and says what is held and shown', () => {
    const snapshot = pageSnapshot(run(withPanels([]), []).state)
    expect(snapshot).toMatchObject({
      [PageSnapshotField.Panels]: [],
      [PageSnapshotField.RadialPosition]: FIRST_SECTOR,
      [PageSnapshotField.NotificationsVisible]: NO_TOASTS,
      [PageSnapshotField.HeldIntents]: [],
    })
    expect(Object.keys(snapshot)).not.toContain(PageSnapshotField.Form)
  })

  it('names the held directions', () => {
    const held = run(withPanels([OWNED_LIST_PANEL]), [press(Intent.Down)]).state
    expect(pageSnapshot(held)[PageSnapshotField.HeldIntents]).toStrictEqual([Intent.Down])
  })
})
