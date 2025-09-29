import * as http from 'node:http';
import { Namespace, Server as SocketIO } from 'socket.io';
import { Adapter } from 'socket.io-adapter';
import { SocketIoServer } from './types';

export const getExcalidrawBaseServerOrFail = (
  options: {
    port: number;
    pingTimeout: number;
    pingInterval: number;
    maxHttpBufferSize: number;
  },
  adapterFactory?: typeof Adapter | ((nsp: Namespace) => Adapter),
): SocketIoServer => {
  const { port, pingTimeout, pingInterval, maxHttpBufferSize } = options;
  const httpServer = http.createServer();
  httpServer.listen(port);

  return new SocketIO(httpServer, {
    transports: ['websocket'],
    adapter: adapterFactory,
    pingTimeout, // default 20000
    pingInterval, // default 25000
    maxHttpBufferSize, // default 1e6 - 1MB
  });
};
