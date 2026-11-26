export function deepFrozen<Value>(value: Value): Value {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  Object.values(value).forEach((child: unknown) => {
    deepFrozen(child)
  })
  return Object.freeze(value)
}
