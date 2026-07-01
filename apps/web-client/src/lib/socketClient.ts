type SocketListener<TPayload = unknown> = (payload: TPayload) => void;

interface SocketMessage {
  event: string;
  payload?: unknown;
}

class SocketClient {
  private socket: WebSocket | null = null;
  private listeners = new Map<string, Set<SocketListener>>();

  connect() {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return this.socket;
    }

    const url = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";
    this.socket = new WebSocket(url);

    this.socket.addEventListener("message", (event) => {
      const message = this.parseMessage(event.data);

      if (!message) {
        return;
      }

      this.listeners.get(message.event)?.forEach((listener) => {
        listener(message.payload);
      });
    });

    return this.socket;
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }

  on<TPayload>(event: string, callback: SocketListener<TPayload>) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(callback as SocketListener);
    this.listeners.set(event, listeners);

    return () => {
      listeners.delete(callback as SocketListener);
    };
  }

  private parseMessage(
    data: string | ArrayBufferLike | Blob | ArrayBufferView,
  ) {
    if (typeof data !== "string") {
      return null;
    }

    try {
      return JSON.parse(data) as SocketMessage;
    } catch {
      return null;
    }
  }
}

export const socketClient = new SocketClient();
