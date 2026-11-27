export type FailureHandler = (operation: string, failure: unknown) => void

function reportFailure(onFailure: FailureHandler, operation: string, failure: unknown): void {
  try {
    onFailure(operation, failure)
  } catch {
    return
  }
}

export function guardedCall<Result>(onFailure: FailureHandler, operation: string, call: () => Result, fallback: Result): Result {
  try {
    return call()
  } catch (failure) {
    reportFailure(onFailure, operation, failure)
    return fallback
  }
}
