import { BaseInputData } from './base.input.data';

export class WhoInputData extends BaseInputData {
  constructor(
    public auth: {
      cookie?: string;
      authorization?: string;
      guestName?: string;
    },
  ) {
    super('who-input');
  }
}
