import { Socket } from 'socket.io-client';
import { broadcast } from '../broadcast';

export function registerTypingHandlers(socket: Socket) {
  socket.on('TYPING_START', (data: any) => {
    broadcast('TYPING_START', {
      channelId: data.channelId,
      userId: data.userId,
      username: data.username,
    });
  });

  socket.on('TYPING_STOP', (data: any) => {
    broadcast('TYPING_STOP', {
      channelId: data.channelId,
      userId: data.userId,
    });
  });
}
