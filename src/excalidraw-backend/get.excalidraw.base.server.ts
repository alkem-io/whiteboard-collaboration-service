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
): {
  wsServer: SocketIoServer;
  httpServer: http.Server;
  bound: Promise<void>;
} => {
  const { port, pingTimeout, pingInterval, maxHttpBufferSize } = options;
  const httpServer = http.createServer();
  // Bind outcome as a promise: without an 'error' listener a bind failure
  // (e.g. EADDRINUSE) is an unhandled 'error' event that crashes the process.
  // Listeners detach each other once the bind settles: a lingering 'error'
  // listener would silently consume post-bind errors (the promise is already
  // settled); with none attached they fail loud per Node's 'error' semantics.
  const bound = new Promise<void>((resolve, reject) => {
    const onListening = () => {
      httpServer.off('error', onError);
      resolve();
    };
    const onError = (err: Error) => {
      httpServer.off('listening', onListening);
      reject(err);
    };
    httpServer.once('listening', onListening);
    httpServer.once('error', onError);
  });
  httpServer.listen(port);

  const wsServer = new SocketIO(httpServer, {
    transports: ['websocket'],
    adapter: adapterFactory,
    pingTimeout, // default 20000
    pingInterval, // default 25000
    maxHttpBufferSize, // default 1e6 - 1MB
  });
  return { wsServer, httpServer, bound };
};
