import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { throttle } from 'lodash';
import { randomUUID } from 'crypto';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { ErrorCause } from '@elastic/elasticsearch/lib/api/types';
import { DetectedChanges } from '../../util/detect.changes';
import { ExcalidrawElement } from '../../excalidraw/types';
import {
  ELASTICSEARCH_CLIENT_PROVIDER,
  isElasticError,
  isElasticResponseError,
} from '../../elasticsearch-client';
import { ConfigType } from '../../config';

type ErroredDocument = {
  status: number | undefined;
  error: ErrorCause | undefined;
  operation: unknown;
  document: unknown;
};

type WhiteboardChangeEventDocument = DetectedChanges<ExcalidrawElement> & {
  '@timestamp': Date;
  createdBy: string;
  whiteboardId: string;
  type: 'insert' | 'update' | 'delete' | 'unknown';
};
@Injectable()
export class ElasticsearchService {
  private readonly sendDataThrottled = throttle(
    this._sendWhiteboardChangeEvent,
    3000,
  );
  private readonly dataToSend: WhiteboardChangeEventDocument[] = [];
  private readonly eventIndexName: string;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private logger: LoggerService,
    @Inject(ELASTICSEARCH_CLIENT_PROVIDER)
    private readonly elasticClient: ElasticClient | undefined,
    private readonly configService: ConfigService<ConfigType, true>,
  ) {
    this.eventIndexName = this.configService.get(
      'monitoring.elasticsearch.indices.whiteboard_events',
      {
        infer: true,
      },
    );
  }

  public async sendWhiteboardChangeEvent(
    roomId: string,
    createdBy: string,
    changes: DetectedChanges<ExcalidrawElement>,
  ) {
    this.dataToSend.push({
      '@timestamp': new Date(),
      whiteboardId: roomId,
      createdBy,
      type: this.eventType(changes),
      ...changes,
    });
    this.sendDataThrottled();
  }

  private async _sendWhiteboardChangeEvent() {
    const result = await this.ingestBulk(this.dataToSend, this.eventIndexName);

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

  private eventType(
    changes: DetectedChanges<any>,
  ): WhiteboardChangeEventDocument['type'] {
    if (changes.updated) {
      return 'update';
    }

    if (changes.inserted) {
      return 'insert';
    }

    if (changes.deleted) {
      return 'delete';
    }

    return 'unknown';
  }
}
