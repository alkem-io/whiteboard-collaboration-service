export const SCENE_INIT = 'scene-init';
export const ROOM_SAVED = 'room-saved';
export const ROOM_NOT_SAVED = 'room-not-saved';
export const SERVER_BROADCAST = 'server-broadcast';
export const SERVER_VOLATILE_BROADCAST = 'server-volatile-broadcast';

export const DISCONNECTING = 'disconnecting';
export const DISCONNECT = 'disconnect';

export const CLIENT_BROADCAST = 'client-broadcast';

export const CONNECTION_CLOSED = 'connection-closed';

export const SERVER_SIDE_ROOM_DELETED = 'server-side-room-deleted';

export const ERROR = 'error';
// messages
export const CONNECTION = 'connection';
export const COLLABORATOR_MODE = 'collaborator-mode';
export const IDLE_STATE = 'idle-state';
export const INIT_ROOM = 'init-room';
export const JOIN_ROOM = 'join-room';
export const ROOM_USER_CHANGE = 'room-user-change';
// system messages
export const PING = 'ping';

// WS subtypes - used within the encrypted payload of SERVER_BROADCAST/SERVER_VOLATILE_BROADCAST
// These are message subtypes that identify the type of data being broadcast
export enum WS_SUBTYPES {
    UPDATE = 'SCENE_UPDATE',
    MOUSE_LOCATION = 'MOUSE_LOCATION',
    IDLE_STATUS = 'IDLE_STATUS',
    FLOATING_EMOJI = 'FLOATING_EMOJI',
    USER_VISIBLE_SCENE_BOUNDS = 'USER_VISIBLE_SCENE_BOUNDS',
}
