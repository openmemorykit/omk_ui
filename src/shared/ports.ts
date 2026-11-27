import type { LocaleBundle } from '../protocol/to-page'
import type { ConfigReading } from './config/read-config'

export interface Clock { now(): number }

export interface ConfigSource { read(): ConfigReading }

export interface LocaleSource { read(locale: string): LocaleBundle | null }
