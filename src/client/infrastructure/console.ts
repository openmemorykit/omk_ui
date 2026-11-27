import type { ConsolePort } from '../application/ports'

export function createConsolePort(): ConsolePort {
  return {
    print: (line) => {
      try {
        console.log(line)
      } catch {
        return
      }
    },
  }
}
