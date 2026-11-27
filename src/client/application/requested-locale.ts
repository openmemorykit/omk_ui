import { isLocaleName } from '../../shared/locales/locale-name'
import type { ClientPorts } from './ports'

export const LOCALE_CONVAR = 'omk_ui_locale'
export const FALLBACK_LOCALE = 'en'

export function requestedLocale(ports: ClientPorts): string {
  const requested = ports.convars.read(LOCALE_CONVAR)
  return requested !== null && isLocaleName(requested) ? requested : FALLBACK_LOCALE
}
