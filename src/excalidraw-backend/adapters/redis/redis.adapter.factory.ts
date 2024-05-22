import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { APP_ID } from '../../../app.id';

export const redisAdapterFactory = (() => {
  const redisHost = 'localhost';
  const redisPort = '6379';

  const pubClient = createClient({ url: `redis://${redisHost}:${redisPort}` });
  const subClient = pubClient.duplicate();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pubClient.on('error', (error: Error) => {
    // todo logging
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  subClient.on('error', (error: Error) => {
    // todo logging
  });
  return createAdapter(pubClient, subClient, {
    requestsTimeout: 10000,
    key: APP_ID,
  });
})();
