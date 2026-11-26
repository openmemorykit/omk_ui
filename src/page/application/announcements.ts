import { Announcement } from '../domain/ui-effects'
import type { MessageKey } from '../i18n/messages'
import { AnnounceUrgency } from './ports'

const KEY_BY_ANNOUNCEMENT: Readonly<Record<Announcement, MessageKey>> = {
  [Announcement.PanelOpened]: 'ui.announce.panelOpened',
  [Announcement.ItemFocused]: 'ui.announce.itemFocused',
  [Announcement.FormErrors]: 'ui.announce.formErrors',
}

export function announcementKey(announcement: Announcement): MessageKey {
  return KEY_BY_ANNOUNCEMENT[announcement]
}

export function announcementUrgency(announcement: Announcement): AnnounceUrgency {
  return announcement === Announcement.FormErrors ? AnnounceUrgency.Assertive : AnnounceUrgency.Polite
}
