import { Injectable } from '@nestjs/common';
import { WhiteboardIntegrationAdapterService } from './whiteboard.integration.adapter.service';
import {
  ContentModifiedInputData,
  ContributionInputData,
  FetchInputData,
  InfoInputData,
  SaveInputData,
  WhoInputData,
} from './inputs';

@Injectable()
export class WhiteboardIntegrationService {
  constructor(
    private readonly integrationAdapter: WhiteboardIntegrationAdapterService,
  ) {}

  public isConnected(): Promise<boolean> {
    return this.integrationAdapter.isConnected();
  }

  public who(data: WhoInputData) {
    return this.integrationAdapter.who(data);
  }

  public info(data: InfoInputData) {
    return this.integrationAdapter.info(data);
  }

  public contentModified(data: ContentModifiedInputData) {
    return this.integrationAdapter.contentModified(data);
  }

  public contribution(data: ContributionInputData) {
    return this.integrationAdapter.contribution(data);
  }

  public save(data: SaveInputData) {
    return this.integrationAdapter.save(data);
  }

  public fetch(data: FetchInputData) {
    return this.integrationAdapter.fetch(data);
  }
}
