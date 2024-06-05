import { Injectable } from '@nestjs/common';
import { WhiteboardIntegrationService } from '../whiteboard-integration/whiteboard.integration.service';
import { UserInfo } from '../whiteboard-integration/user.info';
import {
  ContentModifiedInputData,
  ContributionInputData,
  InfoInputData,
  WhoInputData,
} from '../whiteboard-integration/inputs';

@Injectable()
export class UtilService {
  constructor(
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
}
