// import { Session } from '@ory/kratos-client';
import { UserInfo } from '../../services/whiteboard-integration/user.info';
import { UserIdleState } from './user.idle.state';

type Session = any;

export type SocketData = {
  /***
   * The info of the user connected with the socket
   */
  userInfo: UserInfo;
  /***
   * The timestamp of the last contribution event received;
   * The events are the ones received on the server-broadcast channel
   */
  lastContributed: number;
  /***
   * The timestamp of the last presence received;
   * These events are received with the 'server-volatile-broadcast' event
   */
  lastPresence: number;
  /***
   * True if the user can read the content and see the interactions of others users
   */
  viewer: boolean;
  /***
   * If the user can update the content of the whiteboard and be an active participant in the room, rather than just a viewer
   */
  collaborator: boolean;
  /***
   * The session of the user connected with the socket
   */
  session?: Session;
  /**
   * Amount of consecutive times this socket has failed saving
   */
  consecutiveFailedSaves: number;
  /**
   * Can the socket save the whiteboard.</br>
   * This is individual of the <i>collaborator</i> flag.</br> A socket can still save without being a collaborator.
   * Initial value is based on the available privileges for the room.</br>
   * Set to <i>False</i> after <i>SAVE_CONSECUTIVE_FAILED_ATTEMPTS</i> consecutive failed saves.
   */
  canSave: boolean;
  /**
   * The socket's last known idle state
   */
  state: UserIdleState;
};
