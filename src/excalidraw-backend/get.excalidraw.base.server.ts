import * as http from 'node:http';
import { LoggerService } from '@nestjs/common';
import { Namespace, Server as SocketIO } from 'socket.io';
import { Adapter } from 'socket.io-adapter';
import { SocketIoServer } from './types';

export const getExcalidrawBaseServerOrFail = (
  port: number,
  logger: LoggerService,
  adapterFactory?: typeof Adapter | ((nsp: Namespace) => Adapter),
): SocketIoServer => {
  const httpServer = http.createServer();
  httpServer.listen(port, () => {
    logger.verbose?.(`Collaboration endpoint Listening on port ${port}`);
  });

  return new SocketIO(httpServer, {
    transports: ['websocket'],
    adapter: adapterFactory,
  });
};
