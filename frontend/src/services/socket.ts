import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;
  private isConnecting: boolean = false;
  private statusListeners: Set<(connected: boolean) => void> = new Set();

  get isConnected() {
    return this.socket?.connected ?? false;
  }

  connect() {
    if (this.socket?.connected || this.isConnecting) return;
    this.socket?.disconnect();
    this.isConnecting = true;

    this.socket = io(SOCKET_URL, {
      path: '/socket.io',
      auth: { token: localStorage.getItem('token') },
      reconnectionDelay: 1000,
      reconnection: true,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      this.isConnecting = false;
      console.log('Socket connected');
      this.statusListeners.forEach(cb => cb(true));
    });

    this.socket.on('disconnect', () => {
      this.isConnecting = false;
      console.log('Socket disconnected');
      this.statusListeners.forEach(cb => cb(false));
    });

    this.socket.on('connect_error', () => {
      this.isConnecting = false;
      this.statusListeners.forEach(cb => cb(false));
    });
  }

  onStatusChange(callback: (connected: boolean) => void) {
    this.statusListeners.add(callback);
    if (this.socket) {
      callback(this.socket.connected);
    } else {
      callback(false);
    }
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  on<TArgs extends unknown[]>(event: string, callback: (...args: TArgs) => void) {
    const listener = callback as unknown as (...args: unknown[]) => void;
    this.socket?.on(event, listener);
    return () => this.socket?.off(event, listener);
  }

  off<TArgs extends unknown[]>(event: string, callback?: (...args: TArgs) => void) {
    if (callback) this.socket?.off(event, callback as unknown as (...args: unknown[]) => void);
    else this.socket?.off(event);
  }

  disconnect() {
    this.isConnecting = false;
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const socketService = new SocketService();
