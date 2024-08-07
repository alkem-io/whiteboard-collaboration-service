import { LoggerService } from '@nestjs/common';
import {
  SocketIoSocket,
  SocketIoServer,
  CollaboratorModeReasons,
  UserInfoForRoom,
} from '../types';
import {
  CLIENT_BROADCAST,
  COLLABORATOR_MODE,
  FIRST_IN_ROOM,
  IDLE_STATE,
  NEW_USER,
  ROOM_USER_CHANGE,
} from '../types';
import { minCollaboratorsInRoom } from '../types';
import { SocketEventData } from '../types';
import { IdleStatePayload } from '../types/events';
import { closeConnection } from './util';

const fetchSocketsSafe = async (
  wsServer: SocketIoServer,
  roomID: string,
  logger: LoggerService,
) => {
  try {
    return await wsServer.in(roomID).fetchSockets();
  } catch (e: any) {
    logger.warn(`fetchSockets error handled: ${e?.message}`);
    return [];
  }
};
// todo: split this into multiple functions and combine in one handler
export const authorizeWithRoomAndJoinHandler = async (
  roomID: string,
  socket: SocketIoSocket,
  wsServer: SocketIoServer,
  logger: LoggerService,
  getRoomInfo: (roomId: string, userId: string) => Promise<UserInfoForRoom>,
) => {
  const userInfo = socket.data.userInfo;
  const {
    read: canRead,
    update: canUpdate,
    maxCollaborators,
  } = await getRoomInfo(roomID, userInfo.id);

  if (!canRead) {
    logger.error(
      `Unable to authorize User '${userInfo.id}' with Whiteboard: '${roomID}'`,
    );
    closeConnection(socket, 'Unauthorized read access');
    return;
  }
  // the amount must be defined at this point
  const maxCollaboratorsForThisRoom = maxCollaborators!;

  const collaboratorsInRoom = (
    await fetchSocketsSafe(wsServer, roomID, logger)
  ).filter((socket) => socket.data.collaborator).length;
  const isCollaboratorLimitReached =
    collaboratorsInRoom >= maxCollaboratorsForThisRoom;

  if (isCollaboratorLimitReached) {
    logger.verbose?.(
      `Max collaborators limit (${maxCollaboratorsForThisRoom}) reached for room '${roomID}' - user '${userInfo.email}' is read-only`,
    );
  } else {
    logger.verbose?.(
      `Max collaborators limit NOT reached (${collaboratorsInRoom}/${maxCollaboratorsForThisRoom}) for room '${roomID}' - user '${userInfo.email}' is a collaborator`,
    );
  }

  socket.data.viewer = canRead;
  // the user can't update if the collaborator limit has been reached
  socket.data.collaborator = !isCollaboratorLimitReached && canUpdate;
  socket.data.canSave = canUpdate;

  const reason = calculateReasonForCollaborationMode(
    socket,
    isCollaboratorLimitReached,
    maxCollaboratorsForThisRoom,
  );

  wsServer.to(socket.id).emit(COLLABORATOR_MODE, {
    mode: socket.data.collaborator ? 'write' : 'read',
    reason,
  });

  await joinRoomHandler(roomID, socket, wsServer, logger);
};
/* This event is coming from the client; whenever they request to join a room */
const joinRoomHandler = async (
  roomID: string,
  socket: SocketIoSocket,
  wsServer: SocketIoServer,
  logger: LoggerService,
) => {
  if (!socket.data.viewer) {
    return;
  }

  await socket.join(roomID);

  const { userInfo } = socket.data;

  logger?.verbose?.(`User '${userInfo.email}' has joined room '${roomID}'`);

  const sockets = await fetchSocketsSafe(wsServer, roomID, logger);
  if (sockets.length === 1) {
    logger?.verbose?.(`User '${userInfo.email}' is first in room '${roomID}'`);
    wsServer.to(socket.id).emit(FIRST_IN_ROOM);
  } else {
    logger?.verbose?.(`User '${userInfo.email}' emitted to room '${roomID}'`);
    socket.broadcast.to(roomID).emit(NEW_USER, socket.id);
  }

  const socketIDs = sockets.map((socket) => socket.id);
  wsServer.in(roomID).emit(ROOM_USER_CHANGE, socketIDs);
};
/*
Built-in event for handling broadcast;
messages are sent to all sockets except the sender socket in reliable manner
 */
export const serverBroadcastEventHandler = async (
  roomID: string,
  data: ArrayBuffer,
  socket: SocketIoSocket,
  registerContentModified: (roomId: string, userId: string) => void,
) => {
  if (socket.data.lastContributed === -1) {
    registerContentModified(roomID, socket.data.userInfo.id);
  }

  socket.broadcast.to(roomID).emit(CLIENT_BROADCAST, data);
  socket.data.lastContributed = Date.now();
};
/*
Built-in event for handling broadcast;
messages are sent to all sockets except the sender socket;
not guaranteed to be received if the underlying connection is not ready;
useful for sending event where only the latest is useful, e.g. cursor location
 */
export const serverVolatileBroadcastEventHandler = (
  roomID: string,
  data: ArrayBuffer,
  socket: SocketIoSocket,
) => {
  socket.volatile.broadcast.to(roomID).emit(CLIENT_BROADCAST, data);
  socket.data.lastPresence = Date.now();
};
export const idleStateEventHandler = (
  roomID: string,
  data: ArrayBuffer,
  socket: SocketIoSocket,
  logger: LoggerService,
) => {
  socket.broadcast.to(roomID).emit(IDLE_STATE, data);

  const decoder = new TextDecoder('utf-8');
  const strEventData = decoder.decode(data);
  try {
    const eventData = JSON.parse(
      strEventData,
    ) as SocketEventData<IdleStatePayload>;
    socket.data.state = eventData.payload.userState;
  } catch (e) {
    logger.error({
      message: e?.message ?? JSON.stringify(e),
      data: strEventData,
    });
  }
};
/* Built-in event for handling socket disconnects */
export const disconnectingEventHandler = async (
  wsServer: SocketIoServer,
  socket: SocketIoSocket,
  logger: LoggerService,
) => {
  logger?.verbose?.(`User '${socket.data.userInfo.email}' has disconnected`);
  for (const roomID of socket.rooms) {
    const otherClientIds = (await fetchSocketsSafe(wsServer, roomID, logger))
      .filter((_socket) => _socket.id !== socket.id)
      .map((socket) => socket.id);

    if (otherClientIds.length > 0) {
      socket.broadcast.to(roomID).emit(ROOM_USER_CHANGE, otherClientIds);
    }
  }

  closeConnection(socket);
};

export const disconnectEventHandler = async (socket: SocketIoSocket) => {
  socket.removeAllListeners();
  socket.disconnect(true);
};

const calculateReasonForCollaborationMode = (
  socket: SocketIoSocket,
  isCapacityReached: boolean,
  roomCapacity: number,
) => {
  if (isCapacityReached) {
    return CollaboratorModeReasons.ROOM_CAPACITY_REACHED;
  }

  if (!socket.data.collaborator && roomCapacity === minCollaboratorsInRoom) {
    return CollaboratorModeReasons.MULTI_USER_NOT_ALLOWED;
  }

  return undefined;
};
