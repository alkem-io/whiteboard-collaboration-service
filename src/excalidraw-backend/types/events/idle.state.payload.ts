import { UserIdleState } from '../user.idle.state';

export type IdleStatePayload = {
  socketId: string;
  userState: UserIdleState;
  username: string;
};
