type Handler = (data: any) => void

export class EventEmitter {
  private listeners = new Map<string, Set<Handler>>()

  on(event: string, handler: Handler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler)
  }

  emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(data)
      } catch (error) {
        console.error(`[irontide] handler for "${event}" threw:`, error)
      }
    })
  }

  removeAll(): void {
    this.listeners.clear()
  }
}
