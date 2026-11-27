type Method = (...args: never[]) => unknown

export type PortCall<Port> = {
  readonly [Name in keyof Port]: Port[Name] extends Method ? { readonly method: Name; readonly args: Readonly<Parameters<Port[Name]>> } : never
}[keyof Port]
