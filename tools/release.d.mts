export const FOLDER: string
export interface DeliveredEntry {
  readonly path: string
  readonly data: Buffer
}
export function archiveName(version: string): string
export function collectDeliveredEntries(root: string): DeliveredEntry[]
export function buildArchive(root: string): Buffer
