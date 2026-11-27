export class TraceSessions {
  private everyone = false
  private readonly traced = new Set<number>()
  private readonly excluded = new Set<number>()

  get isEveryoneTraced(): boolean {
    return this.everyone
  }

  get trackedCount(): number {
    return this.traced.size + this.excluded.size
  }

  isActive(player: number): boolean {
    return this.everyone ? !this.excluded.has(player) : this.traced.has(player)
  }

  activateAll(): void {
    this.everyone = true
    this.traced.clear()
    this.excluded.clear()
  }

  deactivateAll(): void {
    this.everyone = false
    this.traced.clear()
    this.excluded.clear()
  }

  activate(player: number): void {
    if (this.everyone) this.excluded.delete(player)
    else this.traced.add(player)
  }

  deactivate(player: number): void {
    if (this.everyone) this.excluded.add(player)
    else this.traced.delete(player)
  }

  forget(player: number): void {
    this.traced.delete(player)
    this.excluded.delete(player)
  }
}
