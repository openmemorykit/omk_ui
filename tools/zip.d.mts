export interface ZipEntry { readonly name: string; readonly data: Buffer }
export function createZip(entries: readonly ZipEntry[]): Buffer
