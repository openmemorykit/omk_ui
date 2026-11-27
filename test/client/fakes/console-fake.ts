import type { ConsolePort } from '../../../src/client/application/ports'

export interface ConsoleFake extends ConsolePort {
  readonly printed: readonly string[]
}

export function createConsoleFake(): ConsoleFake {
  const printed: string[] = []
  return {
    print(line) {
      printed.push(line)
    },
    printed,
  }
}
