import { Module } from '@nestjs/common';
import { RoomResolverQueries } from './room.resolver.queries';
import { ServerModule } from '../../excalidraw-backend/server.module';
import { RoomResolverFields } from './room.resolver.fields';
import { RoomResolverMutations } from './room.resolver.mutations';
import { PeerResolverFields } from './peer.resolver.fields';

@Module({
  imports: [ServerModule],
  providers: [
    RoomResolverQueries,
    RoomResolverFields,
    RoomResolverMutations,
    PeerResolverFields,
  ],
})
export class RoomModule {}
