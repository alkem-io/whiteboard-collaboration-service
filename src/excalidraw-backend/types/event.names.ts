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
  // Server-initiated full-scene reload after an external (e.g. MCP) content
  // write. Reconciled by clients exactly like SCENE_UPDATE (NOT SCENE_INIT,
  // which is the one-time join handler that bypasses the client echo-guard).
  RELOAD = 'SCENE_RELOAD',
  MOUSE_LOCATION = 'MOUSE_LOCATION',
  IDLE_STATUS = 'IDLE_STATUS',
  EMOJI_REACTION = 'EMOJI_REACTION',
  COUNTDOWN_TIMER = 'COUNTDOWN_TIMER',
  USER_VISIBLE_SCENE_BOUNDS = 'USER_VISIBLE_SCENE_BOUNDS',
}
