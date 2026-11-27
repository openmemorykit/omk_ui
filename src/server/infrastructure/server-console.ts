import type { ServerConsole } from '../application/ports'

export function createServerConsole(): ServerConsole {
  return {
    line(text) {
      console.log(text)
    },
  }
}
