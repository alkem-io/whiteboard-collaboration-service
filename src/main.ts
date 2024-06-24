import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from './config';

(async () => {
  const app = await NestFactory.create(AppModule, {
    /***
     * if the logger is provided at a later stage via 'useLogger' after the app has initialized, Nest falls back to the default logger
     * while initializing, which logs a lot of info logs, which we don't have control over and don't want tracked.
     * The logger is disabled while the app is loading ONLY on production to avoid the messages;
     * then the costume logger is applied as usual
     */
    logger: process.env.NODE_ENV === 'production' ? false : undefined,
  });
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  const configService: ConfigService<ConfigType, true> = app.get(ConfigService);
  const port = configService.get('settings.rest.port', {
    infer: true,
  });
  await app.listen(port, () => {
    logger.verbose?.(`Rest endpoint running on port ${port}`);
  });
})();
