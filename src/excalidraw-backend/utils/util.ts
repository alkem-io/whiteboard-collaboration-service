import {
  SocketIoSocket,
  ERROR,
  ERROR_EVENTS,
  CONNECTION_CLOSED,
} from '../types';

// closes the connection for this socket
// and sends an error message before disconnecting
export const closeConnectionWithError = (
  socket: SocketIoSocket,
  error: (typeof ERROR_EVENTS)[keyof typeof ERROR_EVENTS],
) => {
  socket.emit(ERROR, error);
  socket.removeAllListeners();
  socket.disconnect(true);
};
// closes the connection for this socket
// and sends an optional message before disconnecting
export const closeConnection = (socket: SocketIoSocket, message?: string) => {
  if (message) {
    socket.emit(CONNECTION_CLOSED, message);
  }
  socket.removeAllListeners();
  socket.disconnect(true);
};
