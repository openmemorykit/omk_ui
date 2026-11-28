import { printable, UNKNOWN_VALUE } from './server-log'

const ENTRY_SEPARATOR = ', '

function formatValue(value: unknown): string {
  if (typeof value === 'string') return printable(value)
  const json: string | undefined = JSON.stringify(value)
  return printable(json ?? UNKNOWN_VALUE)
}

export function formatReportDetails(data: object): string {
  const record = data as Readonly<Record<string, unknown>>
  return Object.keys(record)
    .map((key) => `${printable(key)}=${formatValue(record[key])}`)
    .join(ENTRY_SEPARATOR)
}
