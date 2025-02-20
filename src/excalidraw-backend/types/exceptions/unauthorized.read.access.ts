import { BaseException, ExceptionDetails } from '../../types/exceptions';

export class UnauthorizedReadAccess extends BaseException {
  constructor(
    message = 'Unauthorized read access',
    details?: ExceptionDetails,
  ) {
    super(message, details);
  }
}
