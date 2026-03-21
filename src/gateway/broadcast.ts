import { Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function setSocket(s: Socket | null): void {
  socket = s;
}

export function getSocket(): Socket | null {
  return socket;
}

/**
 * Broadcast an event to all connected members via the gateway.
 * The gateway will route it to the appropriate rooms.
 */
export function broadcast(event: string, data: any): void {
  if (socket?.connected) {
    socket.emit('NODE_BROADCAST', { event, data });
  }
}
