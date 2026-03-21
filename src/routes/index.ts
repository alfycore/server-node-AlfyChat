import { Express } from 'express';
import serverRouter from './server.routes';
import channelRouter from './channel.routes';
import roleRouter from './role.routes';
import memberRouter from './member.routes';
import messageRouter from './message.routes';
import inviteRouter from './invite.routes';
import fileRouter from './file.routes';
import botRouter from './bot.routes';

export function mountRoutes(app: Express) {
  app.use('/server', serverRouter);
  app.use('/channels', channelRouter);
  app.use('/roles', roleRouter);
  app.use('/members', memberRouter);
  app.use('/messages', messageRouter);
  app.use('/invites', inviteRouter);
  app.use('/files', fileRouter);
  app.use('/bots', botRouter);
}
