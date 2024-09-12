import { Inject, Injectable, LoggerService } from '@nestjs/common';
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
import { ExcalidrawContent } from '../../excalidraw-backend/types';
import { isFetchErrorData } from '../whiteboard-integration/outputs';
import { excalidrawInitContent } from '../../util';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class UtilService {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private logger: LoggerService,
    private readonly integrationService: WhiteboardIntegrationService,
  ) {}

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

    throw new Error('No cookie or authorization header provided');
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

  public save(roomId: string, content: ExcalidrawContent) {
    return this.integrationService.save(
      new SaveInputData(roomId, JSON.stringify(content)),
    );
  }

  public async fetch(roomId: string): Promise<ExcalidrawContent> {
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
}
