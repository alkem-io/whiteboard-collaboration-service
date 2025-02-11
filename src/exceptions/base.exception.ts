import { randomUUID } from 'crypto';
import { ExceptionDetails } from './exception.details';

export class BaseExceptionInternal extends Error {
  public readonly errorId: string;

  constructor(
    public readonly message: string,
    public readonly details?: ExceptionDetails,
  ) {
    super(message);
    this.errorId = randomUUID();
    this.name = this.constructor.name;
  }
}
