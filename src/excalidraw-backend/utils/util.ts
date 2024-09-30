import { SocketIoSocket, CONNECTION_CLOSED } from '../types';

// closes the connection for this socket
// and sends an optional message before disconnecting
export const closeConnection = (socket: SocketIoSocket, message?: string) => {
  if (message) {
    socket.emit(CONNECTION_CLOSED, message);
  }
  socket.removeAllListeners();
  socket.disconnect(true);
};
