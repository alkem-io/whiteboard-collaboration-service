import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { APP_ID } from '../../../app.id';

export const redisAdapterFactory = (() => {
  const redisHost = 'localhost';
  const redisPort = '6379';

  const pubClient = createClient({ url: `redis://${redisHost}:${redisPort}` });
  const subClient = pubClient.duplicate();
  pubClient.on('error', (_error: Error) => {
    // todo logging
  });
  subClient.on('error', (_error: Error) => {
    // todo logging
  });
  return createAdapter(pubClient, subClient, {
    requestsTimeout: 10000,
    key: APP_ID,
  });
})();
