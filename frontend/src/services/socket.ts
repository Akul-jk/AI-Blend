import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private statusListeners: Set<(connected: boolean) => void> = new Set();
  public isConnected = false;

  constructor() {
    // Lazy initialize on first connect call
  }

  public connect() {
    if (this.socket) return;

    console.log('Connecting to WebSocket server at:', SOCKET_URL);
    this.socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected successfully');
      this.isConnected = true;
      this.notifyStatus(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.notifyStatus(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.isConnected = false;
      this.notifyStatus(false);
    });

    // Setup global listeners that were registered prior to connection
    for (const [event, callbacks] of this.listeners.entries()) {
      for (const callback of callbacks) {
        this.socket.on(event, callback);
      }
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.notifyStatus(false);
    }
  }

  public on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  public off(event: string, callback: (...args: any[]) => void) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }

    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  public onStatusChange(callback: (connected: boolean) => void) {
    this.statusListeners.add(callback);
    callback(this.isConnected);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private notifyStatus(connected: boolean) {
    for (const callback of this.statusListeners) {
      try {
        callback(connected);
      } catch (err) {
        console.error('Error executing connection status listener:', err);
      }
    }
  }

  public emit(event: string, ...args: any[]) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, ...args);
    } else {
      console.warn(`Cannot emit "${event}", socket not connected.`);
    }
  }
}

const socketService = new SocketService();
export default socketService;
