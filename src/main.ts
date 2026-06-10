import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ConfigType } from './config';

// Dedicated inbound queue consumed ONLY by this service (server -> collaboration).
// MUST match MessagingQueue.WHITEBOARD_COLLABORATION on the server. It is NOT the
// outbound queue (alkemio-whiteboards) which the server itself consumes.
const WHITEBOARD_COLLABORATION_QUEUE = 'alkemio-whiteboard-collaboration';

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

  // Reuse the exact rabbitmq connection the integration adapter already reads —
  // do not hardcode creds.
  const { host, port, user, password, heartbeat } = configService.get(
    'rabbitmq.connection',
    { infer: true },
  );
  const amqpUrl = `amqp://${user}:${password}@${host}:${port}?heartbeat=${heartbeat}`;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [amqpUrl],
      queue: WHITEBOARD_COLLABORATION_QUEUE,
      queueOptions: { durable: true },
      noAck: true,
    },
  });

  await app.startAllMicroservices();
  logger.verbose?.(
    `Inbound RMQ microservice listening on queue '${WHITEBOARD_COLLABORATION_QUEUE}'`,
  );

  const restPort = configService.get('settings.rest.port', {
    infer: true,
  });
  await app.listen(restPort, () => {
    logger.verbose?.(`Rest endpoint running on port ${restPort}`);
  });
})();
