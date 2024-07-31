import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Peer } from './peer.entity';
import { ContributionTrackingService } from '../../excalidraw-backend/contribution.tracking.service';

@Resolver(() => Peer)
export class PeerResolverFields {
  constructor(
    private readonly contributionTrackingService: ContributionTrackingService,
  ) {}

  @ResolveField('lastContributedAt', () => Date, {
    nullable: true,
    description: 'Time this Peer last contributed to the Room.',
  })
  async peers(@Parent() peer: Peer): Promise<Date | null> {
    const contributions =
      await this.contributionTrackingService.getContributions(peer.roomID);

    const contribution = contributions.find((c) => c.socketID === peer.id);
    return contribution ? contribution.createdAt : null;
  }
}
