import { LoggerService } from '@nestjs/common';
import { UserInfo } from '../../services/whiteboard-integration/user.info';
import { ERROR_EVENTS, SocketIoSocket } from '../types';
import { WrappedMiddlewareHandler } from './middleware.handler.type';

/**
 * Resolve a `UserInfo` for the connecting socket via the supplied getter and
 * attach it to `socket.data.userInfo`. Fail closed: if the getter throws OR
 * returns a falsy value (no `X-Alkemio-Actor-Id` from the gateway forwardAuth,
 * for example), emit USER_INFO_NO_VERIFY and pass an error to socket.io so it
 * rejects the connection. The previous implementation called `next()`
 * unconditionally after the catch, allowing connections with `userInfo`
 * undefined to proceed — that crashed downstream handlers dereferencing
 * `socket.data.userInfo.id`.
 */
export const attachUserInfoOrFailMiddleware: WrappedMiddlewareHandler =
  (
    getter: (socket: SocketIoSocket) => Promise<UserInfo>,
    logger: LoggerService,
  ) =>
  async (socket, next) => {
    const ctx = `socket='${socket.id}'`;

    logger.verbose?.(`[auth] resolving user info — ${ctx}`);

    try {
      const userInfo = await getter(socket);
      if (!userInfo) {
        logger.warn?.(
          `[auth] REJECTED — missing/invalid actor identity — ${ctx}`,
        );
        socket.emit('error', ERROR_EVENTS.USER_INFO_NO_VERIFY);
        return next(new Error('Disconnected with error'));
      }
      socket.data.userInfo = userInfo;
      logger.verbose?.(
        `[auth] ALLOWED — user='${userInfo.id}' guestName='${userInfo.guestName ?? ''}' ${ctx}`,
      );
      return next();
    } catch (e: any) {
      logger.warn?.(
        `[auth] REJECTED — getter threw: ${e?.message ?? e} — ${ctx}`,
      );
      socket.emit('error', ERROR_EVENTS.USER_INFO_NO_VERIFY);
      return next(new Error('Disconnected with error'));
    }
  };
