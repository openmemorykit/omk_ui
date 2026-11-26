import type { Server } from 'node:http'

export interface StaticServer {
  readonly server: Server
  readonly port: number
  close(): Promise<void>
}
export function serveStatic(root: string, port: number): Promise<StaticServer>
