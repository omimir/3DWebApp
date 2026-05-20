// This is a small publish and subscribe bus. The model publishes state changes and
// the views subscribe to them, which keeps the two layers decoupled.
export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
  }

  off(event, handler) {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event, payload) {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }
}
