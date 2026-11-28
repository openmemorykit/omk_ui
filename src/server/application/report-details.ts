import { printable, UNKNOWN_VALUE } from './server-log'

const ENTRY_SEPARATOR = ', '

function formatValue(value: unknown): string {
  return printable(typeof value === 'string' ? value : (JSON.stringify(value) as string | undefined) ?? UNKNOWN_VALUE)
}

export function formatReportDetails(data: object): string {
  const record = data as Readonly<Record<string, unknown>>
  return Object.keys(record)
    .map((key) => `${printable(key)}=${formatValue(record[key])}`)
    .join(ENTRY_SEPARATOR)
}
