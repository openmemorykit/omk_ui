import { createExportsFake, createSerializationFake, EmptyTableShape, type ExportsFake } from '@openmemorykit/core/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_CONFIG } from '../../../src/shared/config/config-schema'
import { ConfigWarningKind } from '../../../src/shared/config/read-config'
import { CONFIG_EXPORT_NAME, createConfigSource } from '../../../src/server/infrastructure/config'
import { KIT_RESOURCE_NAME } from '../../../src/server/infrastructure/resource-name'

const ROOT_KEY = ''

function installExports(): ExportsFake {
  const fake = createExportsFake(createSerializationFake(EmptyTableShape.List), KIT_RESOURCE_NAME)
  vi.stubGlobal('exports', fake.exports)
  return fake
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('server config source', () => {
  it('reads the Lua Config through exports.omk_ui.getConfig and validates it', () => {
    const fake = installExports()
    fake.register(KIT_RESOURCE_NAME, CONFIG_EXPORT_NAME, () => ({ trace: { onStart: true } }))
    const reading = createConfigSource(() => undefined).read()
    expect(reading.config.trace.onStart).toBe(true)
    expect(reading.warnings).toStrictEqual([])
  })

  it('reads an empty Lua table (an empty list once crossed) as the defaults, without warning', () => {
    const fake = installExports()
    fake.register(KIT_RESOURCE_NAME, CONFIG_EXPORT_NAME, () => [])
    expect(createConfigSource(() => undefined).read()).toStrictEqual({ config: DEFAULT_CONFIG, warnings: [] })
  })

  it('falls back to the defaults with a warning, and reports the failure, when getConfig cannot be called', () => {
    installExports()
    const failures: unknown[][] = []
    const reading = createConfigSource((operation, failure) => failures.push([operation, failure])).read()
    expect(reading).toStrictEqual({ config: DEFAULT_CONFIG, warnings: [{ key: ROOT_KEY, kind: ConfigWarningKind.Invalid }] })
    expect(failures.map(([operation]) => operation)).toStrictEqual(['exports.omk_ui.getConfig'])
  })
})
