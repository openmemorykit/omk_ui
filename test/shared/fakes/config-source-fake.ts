import type { ConfigReading } from '../../../src/shared/config/read-config'
import { DEFAULT_CONFIG } from '../../../src/shared/config/config-schema'
import type { ConfigSource } from '../../../src/shared/ports'

export const VALID_DEFAULT_READING: ConfigReading = Object.freeze({ config: DEFAULT_CONFIG, warnings: Object.freeze([]) })

export interface ConfigSourceFake extends ConfigSource {
  readonly readCount: number
  setReading(reading: ConfigReading): void
}

export function createConfigSourceFake(initial: ConfigReading = VALID_DEFAULT_READING): ConfigSourceFake {
  let reading = initial
  let readCount = 0
  return {
    read() {
      readCount += 1
      return reading
    },
    setReading(next) {
      reading = next
    },
    get readCount() {
      return readCount
    },
  }
}
