import { randomUUID } from 'crypto';

export type ExceptionDetails = ExceptionExtraDetails & Record<string, unknown>;

export type ExceptionExtraDetails = {
  message?: string;
  /**
   * A probable cause added manually by the developer
   */
  cause?: string;
  originalException?: Error | unknown;
};

export class BaseException extends Error {
  public readonly errorId: string;

  constructor(
    message: string,
    public readonly details?: ExceptionDetails,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.errorId = randomUUID();
  }
}
