import { describe, expect, it } from 'vitest'
import { announcementKey, announcementUrgency } from '../../../src/page/application/announcements'
import { AnnounceUrgency } from '../../../src/page/application/ports'
import { Announcement } from '../../../src/page/domain/ui-effects'

describe('announcements', () => {
  it('maps each announcement to its ui.announce key', () => {
    expect(Object.values(Announcement).map(announcementKey)).toEqual(['ui.announce.panelOpened', 'ui.announce.itemFocused', 'ui.announce.formErrors'])
  })

  it('is assertive for form errors only', () => {
    expect(announcementUrgency(Announcement.FormErrors)).toBe(AnnounceUrgency.Assertive)
    expect(announcementUrgency(Announcement.PanelOpened)).toBe(AnnounceUrgency.Polite)
    expect(announcementUrgency(Announcement.ItemFocused)).toBe(AnnounceUrgency.Polite)
  })
})
