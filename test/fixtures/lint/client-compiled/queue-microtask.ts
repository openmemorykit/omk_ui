export function later(task: () => void): void {
  queueMicrotask(task)
}
