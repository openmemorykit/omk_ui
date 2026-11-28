const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g
const NAME_GROUP = 1

export function placeholdersOf(text: string): ReadonlySet<string> {
  return new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[NAME_GROUP] ?? ''))
}

export function haveSamePlaceholders(first: string, second: string): boolean {
  const firstNames = placeholdersOf(first)
  const secondNames = placeholdersOf(second)
  return firstNames.size === secondNames.size && [...firstNames].every((name) => secondNames.has(name))
}
