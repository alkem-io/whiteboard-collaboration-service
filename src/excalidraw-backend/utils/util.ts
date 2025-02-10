import { SocketIoSocket, ERROR, ERROR_EVENTS } from '../types';

// closes the connection for this socket
// and sends an optional message before disconnecting
export const closeConnectionWithError = (
  socket: SocketIoSocket,
  error: (typeof ERROR_EVENTS)[keyof typeof ERROR_EVENTS],
) => {
  socket.emit(ERROR, error);
  socket.removeAllListeners();
  socket.disconnect(true);
};
