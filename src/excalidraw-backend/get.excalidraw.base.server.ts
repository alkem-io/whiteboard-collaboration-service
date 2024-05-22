// import http from 'http';
const http = require('http'); // todo why is that?
import { Namespace, Server as SocketIO } from 'socket.io';
import { Adapter } from 'socket.io-adapter';
import { SocketIoServer } from './types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const getExcalidrawBaseServerOrFail = (
  adapterFactory?: typeof Adapter | ((nsp: Namespace) => Adapter),
): SocketIoServer | never => {
  const port = 4002;

  const httpServer = http.createServer();
  httpServer.listen(port, () => {
    console.log('Listening on port', port);
  });

  return new SocketIO(httpServer, {
    transports: ['websocket'],
    adapter: adapterFactory,
  });
};
