import { BaseOutputData } from './base.output.data';

export class SaveOutputData extends BaseOutputData {
  constructor(
    public success: boolean,
    public error?: string,
  ) {
    super('save-output');
  }
}
