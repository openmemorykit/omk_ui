export type FailureReporter = (source: string, error: unknown) => void

function reportSafely(report: FailureReporter, source: string, error: unknown): void {
  try {
    report(source, error)
  } catch {
    return
  }
}

export function guardNative<Result>(report: FailureReporter, source: string, fallback: Result, action: () => Result): Result {
  try {
    return action()
  } catch (error) {
    reportSafely(report, source, error)
    return fallback
  }
}
