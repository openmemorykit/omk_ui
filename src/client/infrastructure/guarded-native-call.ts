export type NativeFailureHandler = (operation: string, failure: unknown) => void

function reportFailure(onFailure: NativeFailureHandler, operation: string, failure: unknown): void {
  try {
    onFailure(operation, failure)
  } catch {
    return
  }
}

export function guardedNativeCall<Result>(onFailure: NativeFailureHandler, operation: string, call: () => Result, fallback: Result): Result {
  try {
    return call()
  } catch (failure) {
    reportFailure(onFailure, operation, failure)
    return fallback
  }
}
