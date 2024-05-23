import { BaseInputData } from './base.input.data';

export class WhoInputData extends BaseInputData {
  constructor(
    public cookie?: string,
    public token?: string,
  ) {
    super('who');
  }
}
