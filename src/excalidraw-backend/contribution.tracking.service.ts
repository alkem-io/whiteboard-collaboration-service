import { Injectable } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { mapValues, map } from 'lodash';

const redisHost = 'localhost';
const redisPort = '6379';

const contributionKeyPrefix =
  'alkemio:whiteboard-collaboration:user-contribution-date';
const metadataKeyPrefix =
  'alkemio:whiteboard-collaboration:user-contribution-metadata';

interface Contribution {
  socketID: string;
  userID: string;
  email: string;
  createdAt: Date;
}

interface TrackContributionParams
  extends Omit<Contribution, 'createdAt' | 'socketID'> {
  createdAt?: Date;
}

/**
 * This service is responsible for tracking contributions to a room.
 * The most straightforward way to do this is to attach a timestamp to a socket.
 * However, since contributions are tracked within a wide time interval, it is likely that a user
 * may disconnect or reconnect. In this case, his contribution timestamp will get lost with the old connection socket.
 * To avoid this, we store contribution timestamps in Redis.
 */
@Injectable()
export class ContributionTrackingService {
  private client: RedisClientType;

  constructor() {
    this.client = createClient({ url: `redis://${redisHost}:${redisPort}` });
  }

  public async trackContribution(
    roomId: string,
    socketID: string,
    { createdAt = new Date(), ...metadata }: TrackContributionParams,
  ) {
    await this.connect();

    await this.client.hSet(
      `${metadataKeyPrefix}:${roomId}`,
      socketID,
      JSON.stringify(metadata),
    );

    return this.client.hSet(
      `${contributionKeyPrefix}:${roomId}`,
      socketID,
      createdAt.toISOString(),
    );
  }

  public async getContributions(roomId: string): Promise<Contribution[]> {
    await this.connect();

    const [contributions, userDetailsJSONs] = await Promise.all([
      this.client.hGetAll(`${contributionKeyPrefix}:${roomId}`),
      this.client.hGetAll(`${metadataKeyPrefix}:${roomId}`),
    ]);

    const userDetails = mapValues(
      userDetailsJSONs,
      (details) =>
        JSON.parse(details) as Omit<Contribution, 'socketID' | 'createdAt'>,
    );

    return map(userDetails, (details, socketID) => {
      return {
        socketID,
        ...details,
        createdAt: new Date(contributions[socketID]),
      };
    });
  }

  public async deleteRoom(roomId: string) {
    await this.connect();

    await Promise.all([
      this.client.del(`${metadataKeyPrefix}:${roomId}`),
      this.client.del(`${contributionKeyPrefix}:${roomId}`),
    ]);
  }

  public async getLatestContributionTime(roomId: string) {
    await this.connect();

    const contributionDates = (
      await this.client.hVals(`${contributionKeyPrefix}:${roomId}`)
    ).map((date) => new Date(date));

    if (contributionDates.length === 0) {
      return null;
    }

    return new Date(
      Math.max(...contributionDates.map((date) => date.getTime())),
    );
  }

  private async connect() {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }
}
