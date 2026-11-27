import type { ServerConsole } from '../../../src/server/application/ports'

export interface ServerConsoleFake extends ServerConsole {
  readonly lines: readonly string[]
}

export function createServerConsoleFake(): ServerConsoleFake {
  const lines: string[] = []
  return {
    line(text) {
      lines.push(text)
    },
    lines,
  }
}
