import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as logform from 'logform';

const LOG_LABEL = 'alkemio-server';

const consoleLoggingStandardFormat: logform.Format[] = [
  winston.format.timestamp(),
  nestWinstonModuleUtilities.format.nestLike(undefined, {
    colors: true,
    prettyPrint: false,
  }),
];

const consoleLoggingProdFormat: logform.Format[] = [
  winston.format.timestamp(),
  winston.format.label({ label: LOG_LABEL }),
  winston.format.json({ deterministic: true }),
];

@Injectable()
export class WinstonConfigService {
  constructor() {}

  async createWinstonModuleOptions() {
    const json = false;
    const consoleEnabled = true;

    const transports: any[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          ...(json ? consoleLoggingProdFormat : consoleLoggingStandardFormat),
        ),
        level: 'verbose',
        silent: !consoleEnabled,
      }),
    ];

    return {
      transports: transports,
    };
  }
}
