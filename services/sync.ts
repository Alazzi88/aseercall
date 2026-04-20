export type SyncEventType =
  | 'REQUEST_CREATED'
  | 'REQUEST_UPDATED'
  | 'ADMISSION_CREATED'
  | 'ADMISSION_DELETED'
  | 'USER_CHANGED';

export interface SyncPayload {
  id?: string;
  priority?: string;
}

export interface SyncEvent {
  type: SyncEventType;
  payload?: SyncPayload;
  timestamp: number;
  tabId: string;
}

const CHANNEL_NAME = 'aseer_health_sync';
const TAB_ID = Math.random().toString(36).slice(2, 9);

class SyncService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(event: SyncEvent) => void> = new Set();

  init(): void {
    if (!('BroadcastChannel' in window)) return;
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (e: MessageEvent) => {
      const event = e.data as SyncEvent;
      if (event.tabId === TAB_ID) return;
      this.listeners.forEach(fn => fn(event));
      // Also fire legacy storage event for components still using it
      window.dispatchEvent(new Event('storage'));
    };
  }

  emit(type: SyncEventType, payload?: SyncPayload): void {
    // Legacy same-tab compat
    window.dispatchEvent(new Event('storage'));

    if (!this.channel) return;
    const event: SyncEvent = { type, payload, timestamp: Date.now(), tabId: TAB_ID };
    this.channel.postMessage(event);
  }

  subscribe(fn: (event: SyncEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  destroy(): void {
    this.channel?.close();
    this.channel = null;
    this.listeners.clear();
  }
}

export const syncService = new SyncService();
