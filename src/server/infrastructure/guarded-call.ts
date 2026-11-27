export type FailureHandler = (error: unknown) => void

function reportFailure(onFailure: FailureHandler, error: unknown): void {
  try {
    onFailure(error)
  } catch {
    return
  }
}

export function runGuarded(action: () => void, onFailure: FailureHandler): void {
  try {
    action()
  } catch (error) {
    reportFailure(onFailure, error)
  }
}

export function runGuardedWithFallback<Result>(action: () => Result, fallback: Result, onFailure: FailureHandler): Result {
  try {
    return action()
  } catch (error) {
    reportFailure(onFailure, error)
    return fallback
  }
}
