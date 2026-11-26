import { AnnounceUrgency, type Announcer } from '../application/ports'

export const ANNOUNCEMENT_MAX_UNITS = 512
const REPEAT_MARK = ' '

export function createLiveAnnouncer(polite: HTMLElement, assertive: HTMLElement): Announcer {
  return {
    announce(text, urgency) {
      const region = urgency === AnnounceUrgency.Assertive ? assertive : polite
      const bounded = text.slice(0, ANNOUNCEMENT_MAX_UNITS)
      region.textContent = region.textContent === bounded ? `${bounded}${REPEAT_MARK}` : bounded
    },
  }
}
