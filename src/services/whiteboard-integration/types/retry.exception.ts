import {
  BaseException,
  ExceptionDetails,
} from '../../../excalidraw-backend/types/exceptions';

export class RetryException extends BaseException {
  constructor(public readonly details?: ExceptionDetails) {
    super('Timeout', details);
  }
}
