import { Injectable } from '@nestjs/common';
import { Args, Query } from '@nestjs/graphql';
import { Room } from './room.entity';
import { Server } from '../../excalidraw-backend/server';

@Injectable()
export class RoomResolverQueries {
  constructor(
    private readonly excalidrawServer: Server,
  ) {}

  @Query(() => [Room])
  async rooms() {
    const rooms = await this.excalidrawServer.listRooms();

    return rooms;
  }

  /**
   * For convenience and to save on the number of requests going through RabbitMQ,
   * you can query an individual Room.
   */
  @Query(() => Room)
  async room(@Args('id') id: string) {
    return {
      id,
    };
  }
}