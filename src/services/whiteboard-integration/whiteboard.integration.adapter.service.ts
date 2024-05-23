import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { firstValueFrom, timeout } from 'rxjs';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { UserInfo } from './user.info';
import { WhiteboardIntegrationMessagePattern } from './message.pattern.enum';
import {
  WhoInputData,
  ContentModifiedInputData,
  ContributionInputData,
  InfoInputData,
} from './inputs';
import { InfoOutputData } from './outputs';
import { WhiteboardIntegrationEventPattern } from './event.pattern.enum';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from '../../config';

@Injectable()
export class WhiteboardIntegrationAdapterService {
  private readonly client: ClientProxy | undefined;
  private readonly timeoutMs: number;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private logger: LoggerService,
    private readonly configService: ConfigService<ConfigType, true>,
  ) {
    const rabbitMqOptions = this.configService.get('rabbitmq.connection', {
      infer: true,
    });
    this.client = authQueueClientProxyFactory(rabbitMqOptions, this.logger);

    if (!this.client) {
      console.error(
        `${WhiteboardIntegrationAdapterService.name} not initialized`,
      );
    }

    this.timeoutMs = this.configService.get(
      'settings.application.queue_response_timeout',
      { infer: true },
    );
  }

  public async who(data: WhoInputData) {
    return this.sendWithResponse<UserInfo, WhoInputData>(
      WhiteboardIntegrationMessagePattern.WHO,
      data,
    ).catch(() => ({
      id: 'N/A',
      email: 'N/A',
    }));
  }

  public async info(data: InfoInputData) {
    return this.sendWithResponse<InfoOutputData, InfoInputData>(
      WhiteboardIntegrationMessagePattern.INFO,
      data,
    ).catch(() => {
      return {
        read: false,
        update: false,
        maxCollaborators: undefined,
      };
    });
  }

  public async contentModified(data: ContentModifiedInputData) {
    try {
      return this.sendWithoutResponse<ContentModifiedInputData>(
        WhiteboardIntegrationEventPattern.CONTENT_MODIFIED,
        data,
      );
    } catch (e) {
      // ... do nothing
    }
  }

  public async contribution(data: ContributionInputData) {
    try {
      return this.sendWithoutResponse<ContributionInputData>(
        WhiteboardIntegrationEventPattern.CONTRIBUTION,
        data,
      );
    } catch (e) {
      // ... do nothing
    }
  }
  // todo: work on exception handling: logging here vs at consumer
  /**
   * Sends a message to the queue and waits for a response.
   * Each consumer needs to manually handle failures, returning the proper type.
   * @param pattern
   * @param data
   */
  private sendWithResponse = async <TResult, TInput>(
    pattern: WhiteboardIntegrationMessagePattern,
    data: TInput,
  ): Promise<TResult | never> => {
    if (!this.client) {
      throw new Error(`Connection was not established. Send failed.`);
    }

    const result$ = this.client
      .send<TResult, TInput>(pattern, data)
      .pipe(timeout({ first: this.timeoutMs }));

    return firstValueFrom(result$).catch((err) => {
      this.logger.error(
        err?.message ?? err,
        err?.stack,
        JSON.stringify({
          pattern,
          data,
          timeout: this.timeoutMs,
        }),
      );

      throw new Error('Error while processing integration request.');
    });
  };
  // todo: work on exception handling: logging here vs at consumer
  /**
   * Sends a message to the queue without waiting for a response.
   * Each consumer needs to manually handle failures, returning the proper type.
   * @param pattern
   * @param data
   */
  private sendWithoutResponse = <TInput>(
    pattern: WhiteboardIntegrationEventPattern,
    data: TInput,
  ): void | never => {
    if (!this.client) {
      throw new Error(`Connection was not established. Send failed.`);
    }

    this.client.emit<void, TInput>(pattern, data);
  };
}

const authQueueClientProxyFactory = (
  config: {
    user: string;
    password: string;
    host: string;
    port: number;
  },
  logger: LoggerService,
): ClientProxy | undefined => {
  const { host, port, user, password } = config;
  // todo: move to config
  const heartbeat = process.env.NODE_ENV === 'production' ? '30' : '120';
  const queue = 'auth';
  const connectionString = `amqp://${user}:${password}@${host}:${port}?heartbeat=${heartbeat}`;
  try {
    const options = {
      urls: [connectionString],
      queue,
      queueOptions: { durable: true },
      noAck: true,
    };
    return ClientProxyFactory.create({ transport: Transport.RMQ, options });
  } catch (err) {
    logger.error(`Could not connect to RabbitMQ: ${err}`);
    return undefined;
  }
};
