import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { WhiteboardIntegrationService } from '../whiteboard-integration/whiteboard.integration.service';
import { UserInfo } from '../whiteboard-integration/user.info';
import {
  ContentModifiedInputData,
  ContributionInputData,
  FetchInputData,
  InfoInputData,
  SaveInputData,
  WhoInputData,
} from '../whiteboard-integration/inputs';
import { ExcalidrawContent, ExcalidrawElement } from '../../excalidraw/types';
import { excalidrawInitContent } from '../../util';
import { DeepReadonly } from '../../excalidraw-backend/utils';
import { isFetchErrorData } from '../whiteboard-integration/outputs';
import { detectChanges } from '../../util/detect-changes/detect.changes';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import {
  ConfigType,
  WhiteboardEventLoggingMode,
  WhiteboardEventLoggingModeType,
} from '../../config';

@Injectable()
export class UtilService {
  private readonly eventLoggingMode: WhiteboardEventLoggingModeType;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private logger: LoggerService,
    private readonly integrationService: WhiteboardIntegrationService,
    private readonly elasticService: ElasticsearchService,
    private readonly configService: ConfigService<ConfigType, true>,
  ) {
    this.eventLoggingMode = this.configService.get(
      'monitoring.logging.events.mode',
      {
        infer: true,
      },
    );
  }

  public async getUserInfo(opts: {
    cookie?: string;
    authorization?: string;
  }): Promise<UserInfo | never> {
    const { cookie, authorization } = opts;

    if (authorization) {
      return this.integrationService.who(new WhoInputData({ authorization }));
    }

    if (cookie) {
      return this.integrationService.who(new WhoInputData({ cookie }));
    }

    // throw new Error('No cookie or authorization header provided');
    return {
      id: '',
      email: '',
    };
  }

  public getUserInfoForRoom(userId: string, roomId: string) {
    return this.integrationService.info(new InfoInputData(userId, roomId));
  }

  public contentModified(userId: string, roomId: string) {
    return this.integrationService.contentModified(
      new ContentModifiedInputData(userId, roomId),
    );
  }

  public contribution(roomId: string, users: { id: string; email: string }[]) {
    return this.integrationService.contribution(
      new ContributionInputData(roomId, users),
    );
  }

  public save(roomId: string, content: DeepReadonly<ExcalidrawContent>) {
    return this.integrationService.save(
      new SaveInputData(roomId, JSON.stringify(content)),
    );
  }

  /**
   * Fetches the content of the whiteboard from DB or if not found returns an initial empty content.
   * @param roomId Whiteboard ID
   */
  public async fetchContentFromDbOrEmpty(
    roomId: string,
  ): Promise<ExcalidrawContent> {
    const { data } = await this.integrationService.fetch(
      new FetchInputData(roomId),
    );

    if (isFetchErrorData(data)) {
      return excalidrawInitContent;
    }

    try {
      return JSON.parse(data.content);
    } catch (e: any) {
      this.logger.error(e, e?.stack);
      return excalidrawInitContent;
    }
  }

  public reportChanges(
    roomId: string,
    createdBy: string,
    oldEl: ExcalidrawElement[],
    newEl: ExcalidrawElement[],
  ) {
    if (this.eventLoggingMode === WhiteboardEventLoggingMode.none) {
      return;
    }
    // we need the changes to calculate the types correctly
    const changes = detectChanges(oldEl, newEl, [
      'version',
      'versionNonce',
      'updated',
      'boundElements',
    ]);
    if (!changes) {
      return;
    }

    this.elasticService.sendWhiteboardChangeEvent(roomId, createdBy, changes);
  }
}
