const ENTRY_SEPARATOR = ', '

function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export function formatReportDetails(data: object): string {
  const record = data as Readonly<Record<string, unknown>>
  return Object.keys(record)
    .map((key) => `${key}=${formatValue(record[key])}`)
    .join(ENTRY_SEPARATOR)
}
