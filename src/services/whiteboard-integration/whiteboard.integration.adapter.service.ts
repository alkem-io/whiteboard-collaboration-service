import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { firstValueFrom, map, throwError, timeInterval, timeout } from 'rxjs';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { UserInfo } from './user.info';
import { WhiteboardIntegrationMessagePattern } from './message.pattern.enum';
import {
  ContentModifiedInputData,
  ContributionInputData,
  FetchInputData,
  InfoInputData,
  SaveInputData,
  WhoInputData,
} from './inputs';
import {
  FetchErrorData,
  FetchOutputData,
  HealthCheckOutputData,
  InfoOutputData,
  SaveErrorData,
  SaveOutputData,
} from './outputs';
import { WhiteboardIntegrationEventPattern } from './event.pattern.enum';
import { ConfigService } from '@nestjs/config';
import { ConfigType } from '../../config';
import { RmqOptions } from '@nestjs/microservices/interfaces/microservice-configuration.interface';
import { RMQConnectionError, OurTimeoutError } from './types';

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
    const queue = this.configService.get('settings.application.queue', {
      infer: true,
    });

    this.client = authQueueClientProxyFactory(
      {
        ...rabbitMqOptions,
        queue,
      },
      this.logger,
    );

    if (!this.client) {
      this.logger.error(
        `${WhiteboardIntegrationAdapterService.name} not initialized`,
      );
      return;
    }
    // don't block the constructor
    this.client
      .connect()
      .then(() => {
        this.logger.verbose?.(
          'Client proxy successfully connected to RabbitMQ',
        );
      })
      .catch((error: RMQConnectionError | undefined) =>
        this.logger.error(error?.err, error?.err.stack),
      );

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
      this.logger.error(e, e?.stack);
    }
  }

  public async contribution(data: ContributionInputData) {
    try {
      return this.sendWithoutResponse<ContributionInputData>(
        WhiteboardIntegrationEventPattern.CONTRIBUTION,
        data,
      );
    } catch (e) {
      this.logger.error(e, e?.stack);
    }
  }

  public async save(data: SaveInputData) {
    try {
      return await this.sendWithResponse<SaveOutputData, SaveInputData>(
        WhiteboardIntegrationMessagePattern.SAVE,
        data,
      );
    } catch (e) {
      return new SaveOutputData(
        new SaveErrorData(e?.message ?? JSON.stringify(e)),
      );
    }
  }

  public async fetch(data: FetchInputData) {
    try {
      return await this.sendWithResponse<FetchOutputData, FetchInputData>(
        WhiteboardIntegrationMessagePattern.FETCH,
        data,
      );
    } catch (e) {
      return new FetchOutputData(
        new FetchErrorData(e?.message ?? JSON.stringify(e)),
      );
    }
  }

  /**
   * Is there a healthy connection to the queue
   */
  public async isConnected(): Promise<boolean> {
    return this.sendWithResponse<HealthCheckOutputData, string>(
      WhiteboardIntegrationMessagePattern.HEALTH_CHECK,
      'healthy?',
      { timeoutMs: 3000 },
    )
      .then((resp) => resp.healthy)
      .catch(() => false);
  }

  // todo: work on exception handling: logging here vs at consumer
  /**
   * Sends a message to the queue and waits for a response.
   * Each consumer needs to manually handle failures, returning the proper type.
   * @param pattern
   * @param data
   * @param options
   */
  private sendWithResponse = async <TResult, TInput>(
    pattern: WhiteboardIntegrationMessagePattern,
    data: TInput,
    options?: { timeoutMs?: number },
  ): Promise<TResult | never> => {
    if (!this.client) {
      throw new Error(`Connection was not established. Send failed.`);
    }

    const timeoutMs = options?.timeoutMs ?? this.timeoutMs;

    const result$ = this.client.send<TResult, TInput>(pattern, data).pipe(
      timeInterval(),
      map((x) => {
        this.logger.debug?.({
          method: `sendWithResponse response took ${x.interval}ms`,
          pattern,
          data,
          value: x.value,
        });
        return x.value;
      }),
      timeout({
        each: timeoutMs,
        with: () => throwError(() => new OurTimeoutError()),
      }),
    );

    return firstValueFrom(result$).catch(
      (
        error:
          | RMQConnectionError
          | OurTimeoutError
          | Error
          | Record<string, unknown>
          | undefined
          | null,
      ) => {
        // null or undefined
        if (error == undefined) {
          this.logger.error({
            message: `'${error}' error caught while processing integration request.`,
            pattern,
            timeout: timeoutMs,
          });

          throw new Error(
            `'${error}' error caught while processing integration request.`,
          );
        }

        if (error instanceof OurTimeoutError) {
          this.logger.error(
            {
              message: `Timeout was reached while waiting for response`,
              pattern,
              timeout: timeoutMs,
            },
            error.stack,
          );

          throw new Error('Timeout while processing integration request.');
        } else if (error instanceof RMQConnectionError) {
          this.logger.error(
            {
              message: `Error was received while waiting for response: ${error?.err?.message}`,
              pattern,
              timeout: timeoutMs,
            },
            error?.err?.stack,
          );

          throw new Error(
            'RMQ connection error while processing integration request.',
          );
        } else if (error instanceof Error) {
          this.logger.error(
            {
              message: `Error was received while waiting for response: ${error.message}`,
              pattern,
              timeout: timeoutMs,
            },
            error.stack,
          );

          throw new Error(
            `${error.name} error while processing integration request.`,
          );
        } else {
          this.logger.error({
            message: `Unknown error was received while waiting for response: ${JSON.stringify(error, null, 2)}`,
            pattern,
            timeout: timeoutMs,
          });

          throw new Error(
            `Unknown error while processing integration request.`,
          );
        }
      },
    );
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

    this.logger.debug?.({
      method: 'sendWithoutResponse',
      pattern,
      data,
    });

    this.client.emit<void, TInput>(pattern, data);
  };
}

const authQueueClientProxyFactory = (
  config: {
    user: string;
    password: string;
    host: string;
    port: number;
    heartbeat: number;
    queue: string;
  },
  logger: LoggerService,
): ClientProxy | undefined => {
  const { host, port, user, password, heartbeat: _heartbeat, queue } = config;
  const heartbeat =
    process.env.NODE_ENV === 'production' ? _heartbeat : _heartbeat * 3;
  logger.verbose?.({ ...config, heartbeat, password: undefined });
  try {
    const options: RmqOptions = {
      transport: Transport.RMQ,
      options: {
        urls: [
          {
            protocol: 'amqp',
            hostname: host,
            username: user,
            password,
            port,
            heartbeat,
          },
        ],
        queue,
        queueOptions: { durable: true },
        noAck: true,
      },
    };
    return ClientProxyFactory.create(options);
  } catch (err) {
    logger.error(`Could not connect to RabbitMQ: ${err}`);
    return undefined;
  }
};
