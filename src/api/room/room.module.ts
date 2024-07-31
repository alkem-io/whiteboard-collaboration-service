import { Module } from '@nestjs/common';
import { RoomResolverQueries } from './room.resolver.queries';
import { ServerModule } from '../../excalidraw-backend/server.module';
import { UtilModule } from '../../services/util/util.module';
import { RoomResolverFields } from './room.resolver.fields';
import { RoomResolverMutations } from './room.resolver.mutations';

@Module({
  imports: [ServerModule, UtilModule],
  providers: [RoomResolverQueries, RoomResolverFields, RoomResolverMutations],
})
export class RoomModule {}
