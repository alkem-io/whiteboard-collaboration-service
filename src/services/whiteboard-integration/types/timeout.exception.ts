import {
  BaseException,
  ExceptionDetails,
} from '../../../excalidraw-backend/types/exceptions';

export class TimeoutException extends BaseException {
  constructor(public readonly details?: ExceptionDetails) {
    super('Timeout', details);
  }
}
