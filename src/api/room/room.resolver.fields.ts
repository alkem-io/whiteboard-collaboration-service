import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Room } from './room.entity';
import { Peer } from './peer.entity';
import { Server } from '../../excalidraw-backend/server';
import { ContributionTrackingService } from '../../excalidraw-backend/contribution.tracking.service';

@Resolver(() => Room)
export class RoomResolverFields {
  constructor(
    private readonly excalidrawServer: Server,
    private readonly contributionTrackingService: ContributionTrackingService,
  ) {}

  @ResolveField('peers', () => [Peer], {
    nullable: false,
    description: 'Peers in this Room.',
  })
  async peers(@Parent() room: Room): Promise<Peer[]> {
    const sockets = await this.excalidrawServer.fetchSocketsSafe(room.id);
    return sockets.map((socket) => ({
      id: socket.id,
      userID: socket.data.userInfo.id,
      email: socket.data.userInfo.email,
      roomID: room.id,
    }));
  }

  @ResolveField('lastContributedToAt', () => Date, {
    nullable: true,
    description: 'The date of the last contribution to this Room.',
  })
  async lastContributedToAt(@Parent() room: Room): Promise<Date | null> {
    return await this.contributionTrackingService.getLatestContributionTime(
      room.id,
    );
  }
}
