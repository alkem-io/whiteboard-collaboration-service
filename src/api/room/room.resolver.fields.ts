import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Room } from './room.interface';
import { Peer } from './peer.entity';
import { Server } from '../../excalidraw-backend/server';
import { UtilService } from '../../services/util/util.service';

@Resolver(() => Room)
export class RoomResolverFields {
  constructor(
    private readonly excalidrawServer: Server,
    private readonly utilService: UtilService,
  ) {}

  @ResolveField('peers', () => [Peer], {
    nullable: false,
    description: 'Peers in this Room.',
  })
  async peers(@Parent() room: Room): Promise<Peer[]> {
    const sockets = await this.excalidrawServer.fetchSocketsSafe(room.id);
    const usersInfo = await Promise.all(
      sockets.map((socket) =>
        this.utilService.getUserInfo(socket.handshake.headers),
      ),
    );
    return usersInfo;
  }
}
