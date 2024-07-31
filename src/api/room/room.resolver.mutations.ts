import { Injectable } from '@nestjs/common';
import { Args, Mutation } from '@nestjs/graphql';
import { Room } from './room.interface';
import { Server } from '../../excalidraw-backend/server';

@Injectable()
export class RoomResolverMutations {
  constructor(private readonly excalidrawServer: Server) {}

  @Mutation(() => Room, {
    name: 'destroyRoom',
    description:
      'Disconnect all peers from a Room, resulting in Room being deleted.',
  })
  async destroyRoom(@Args('roomID') roomID: string) {
    return this.excalidrawServer.destroyRoom(roomID);
  }
}
