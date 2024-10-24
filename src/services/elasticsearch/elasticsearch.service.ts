import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { throttle } from 'lodash';
import { randomUUID } from 'crypto';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { ErrorCause } from '@elastic/elasticsearch/lib/api/types';
import {
  DetectedChanges,
  DetectedChangesType,
} from '../../util/detect.changes';
import { ExcalidrawElement } from '../../excalidraw/types';
import {
  ELASTICSEARCH_CLIENT_PROVIDER,
  isElasticError,
  isElasticResponseError,
} from '../../elasticsearch-client';
import {
  ConfigType,
  WhiteboardEventLoggingMode,
  WhiteboardEventLoggingModeType,
} from '../../config';

type ErroredDocument = {
  status: number | undefined;
  error: ErrorCause | undefined;
  operation: unknown;
  document: unknown;
};

type BaseChangeEventDocument = {
  '@timestamp': Date;
  createdBy: string;
  whiteboardId: string;
  types: DetectedChangesType[];
};

type LightChangeEventDocument = BaseChangeEventDocument;
type FullChangeEventDocument = BaseChangeEventDocument &
  DetectedChanges<ExcalidrawElement>;

type WhiteboardChangeEventDocument =
  | LightChangeEventDocument
  | FullChangeEventDocument;

@Injectable()
export class ElasticsearchService {
  private readonly sendDataThrottled;
  private readonly dataToSend: WhiteboardChangeEventDocument[] = [];
  private readonly eventIndex: string;
  private readonly eventLoggingMode: WhiteboardEventLoggingModeType;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private logger: LoggerService,
    @Inject(ELASTICSEARCH_CLIENT_PROVIDER)
    private readonly elasticClient: ElasticClient | undefined,
    private readonly configService: ConfigService<ConfigType, true>,
  ) {
    const eventsConfig = this.configService.get('monitoring.logging.events', {
      infer: true,
    });
    this.eventIndex = eventsConfig.whiteboard_event_index;
    this.eventLoggingMode = eventsConfig.mode;

    this.sendDataThrottled = throttle(
      this._sendWhiteboardChangeEvent,
      eventsConfig.interval,
    );
  }

  public sendWhiteboardChangeEventType(
    roomId: string,
    createdBy: string,
    types: DetectedChangesType[],
  ) {
    const lightDocument: LightChangeEventDocument = {
      '@timestamp': new Date(),
      whiteboardId: roomId,
      createdBy,
      types,
    };

    this.dataToSend.push(lightDocument);
    this.sendDataThrottled();
  }

  public sendWhiteboardChangeEvent(
    roomId: string,
    createdBy: string,
    changes: DetectedChanges<ExcalidrawElement>,
  ) {
    if (this.eventLoggingMode === WhiteboardEventLoggingMode.none) {
      return;
    }

    const baseDocument: BaseChangeEventDocument = {
      '@timestamp': new Date(),
      whiteboardId: roomId,
      createdBy,
      types: this.eventType(changes),
    };

    if (this.eventLoggingMode === WhiteboardEventLoggingMode.lite) {
      this.dataToSend.push(baseDocument);
    }

    if (this.eventLoggingMode === WhiteboardEventLoggingMode.full) {
      this.dataToSend.push({
        ...baseDocument,
        ...changes,
      });
    }

    this.sendDataThrottled();
  }

  private async _sendWhiteboardChangeEvent() {
    const result = await this.ingestBulk(this.dataToSend, this.eventIndex);

    this.dataToSend.length = 0;

    return result;
  }

  private async ingestBulk(data: unknown[], index: string): Promise<void> {
    if (!this.elasticClient) {
      return;
    }

    if (!data.length) {
      return;
    }

    const operations = data.flatMap((doc) => [
      { create: { _index: index } },
      doc,
    ]);

    const bulkResponse = await this.elasticClient.bulk({ operations });

    if (bulkResponse.errors) {
      const erroredDocuments: ErroredDocument[] = [];
      // The items array has the same order of the dataset we just indexed.
      // The presence of the `error` key indicates that the operation
      // that we did for the document has failed.
      bulkResponse.items.forEach((action, i) => {
        const operation = Object.keys(action)[0] as keyof typeof action;
        if (action[operation]?.error) {
          erroredDocuments.push({
            // If the status is 429 it means that you can retry the document,
            // otherwise it's very likely a mapping error, and you should
            // fix the document before to try it again.
            status: action[operation]?.status,
            error: action[operation]?.error,
            operation: operations[i * 2],
            document: operations[i * 2 + 1],
          });
        }
      });
      this.logger.error(
        `[${index}] - ${erroredDocuments.length} documents errored. ${
          data.length - erroredDocuments.length
        } documents indexed.`,
      );
    } else {
      this.logger.verbose?.(`[${index}] - ${data.length} documents indexed`);
    }
  }

  private handleError(error: unknown) {
    const errorId = randomUUID();
    const baseParams = {
      uuid: errorId,
    };

    if (isElasticResponseError(error)) {
      this.logger.error(
        {
          ...baseParams,
          message: error.message,
          name: error.name,
          status: error.meta.statusCode,
        },
        error?.stack,
      );
    } else if (isElasticError(error)) {
      this.logger.error({
        ...baseParams,
        type: error.error.type,
        status: error.status,
      });
    } else if (error instanceof Error) {
      this.logger.error(
        {
          ...baseParams,
          message: error.message,
          name: error.name,
        },
        error?.stack,
      );
    } else {
      this.logger.error({ ...baseParams, error });
    }

    return errorId;
  }

  private eventType(changes: DetectedChanges<any>): DetectedChangesType[] {
    const types: DetectedChangesType[] = [];

    if (changes.inserted) {
      types.push('insert');
    }

    if (changes.updated) {
      types.push('update');
    }

    if (changes.deleted) {
      types.push('delete');
    }

    return types.length > 0 ? types : ['unknown'];
  }
}
