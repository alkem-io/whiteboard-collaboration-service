import { ExcalidrawContent } from '../excalidraw/types/excalidraw.content';
import { ExcalidrawElement } from '../excalidraw/types/excalidraw.element';

// Mock the socket.io engine factory so constructing the Server never binds a
// real HTTP port. `mock`-prefixed names are the only out-of-scope references a
// jest.mock() factory is allowed to close over.
const mockWsHandles = {
  emit: jest.fn(),
  fetchSockets: jest.fn().mockResolvedValue([]),
};
jest.mock('./index', () => ({
  getExcalidrawBaseServerOrFail: () => ({
    wsServer: {
      in: () => ({
        emit: mockWsHandles.emit,
        fetchSockets: mockWsHandles.fetchSockets,
      }),
      of: () => ({ adapter: { on: jest.fn() } }),
      use: jest.fn(),
      on: jest.fn(),
    },
    httpServer: { listening: true },
    bound: Promise.resolve(),
  }),
}));

import { Server } from './server';
import { InMemorySnapshot } from './types/in.memory.snapshot';

const ROOM = '00000000-0000-0000-0000-000000000001'; // isRoomId => length 36

const el = (
  id: string,
  version: number,
  extra: Partial<ExcalidrawElement> = {},
): ExcalidrawElement =>
  ({
    id,
    type: 'rectangle',
    version,
    versionNonce: 1,
    index: null,
    updated: 1,
    isDeleted: false,
    boundElements: null,
    ...extra,
  }) as ExcalidrawElement;

const content = (elements: ExcalidrawElement[]): ExcalidrawContent => ({
  type: 'excalidraw',
  version: 1,
  source: '',
  elements,
  appState: {},
  files: {},
});

const makeServer = (utilOverrides: Record<string, unknown> = {}): Server => {
  const logger = {
    verbose: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  };
  const utilService = {
    fetchContentFromDbOrEmpty: jest.fn().mockResolvedValue(content([])),
    save: jest.fn(),
    ...utilOverrides,
  };
  const configService = {
    get: (key: string) => {
      if (key === 'settings.application') {
        return {
          port: 0,
          ping_timeout: 1,
          ping_interval: 1,
          max_http_buffer_size: 1,
        };
      }
      if (key === 'settings.collaboration') {
        return {
          contribution_window: 1,
          save_interval: 1,
          collaborator_inactivity: 1,
          permission_check_interval: 1,
        };
      }
      return {};
    },
  };
  return new Server(logger as any, utilService as any, configService as any);
};

const snapshotsOf = (server: Server) =>
  (server as any).snapshots as Map<string, InMemorySnapshot>;

describe('Server.applyExternalContentUpdate (orchestration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWsHandles.fetchSockets.mockResolvedValue([]);
  });

  it('merges a delta into an OPEN room, broadcasts SCENE_UPDATE, and queues a save', async () => {
    const server = makeServer();
    snapshotsOf(server).set(
      ROOM,
      new InMemorySnapshot(content([el('a', 1)]), 1),
    );
    const queueSave = jest
      .spyOn(server as any, 'queueSave')
      .mockImplementation(() => undefined);

    await server.applyExternalContentUpdate(ROOM, {
      elements: [el('b', 1)],
      files: {},
    });

    // The live snapshot now holds both the pre-existing 'a' and the merged 'b'.
    const merged = snapshotsOf(server).get(ROOM) as InMemorySnapshot;
    expect(merged.content.elements.map(e => e.id).sort()).toEqual(['a', 'b']);

    // A single SCENE_UPDATE broadcast carrying the external write.
    expect(mockWsHandles.emit).toHaveBeenCalledTimes(1);
    const [event, buffer] = mockWsHandles.emit.mock.calls[0];
    expect(event).toBe('client-broadcast');
    const payload = JSON.parse(Buffer.from(buffer as ArrayBuffer).toString());
    expect(payload.type).toBe('SCENE_UPDATE');
    expect(payload.payload.elements.map((e: any) => e.id)).toContain('b');

    // Persisted via the normal throttled path.
    expect(queueSave).toHaveBeenCalledWith(ROOM);
  });

  it('skips silently when the room is open nowhere (no snapshot, no sockets)', async () => {
    const server = makeServer();
    mockWsHandles.fetchSockets.mockResolvedValueOnce([]);

    await server.applyExternalContentUpdate(ROOM, { elements: [el('b', 1)] });

    expect(mockWsHandles.emit).not.toHaveBeenCalled();
    expect(snapshotsOf(server).has(ROOM)).toBe(false);
  });

  it('falls back to a safe full-DB reconcile when no element delta is supplied', async () => {
    const dbEl = el('db', 9);
    const server = makeServer({
      fetchContentFromDbOrEmpty: jest.fn().mockResolvedValue(content([dbEl])),
    });
    snapshotsOf(server).set(ROOM, new InMemorySnapshot(content([]), 1));
    jest.spyOn(server as any, 'queueSave').mockImplementation(() => undefined);

    await server.applyExternalContentUpdate(ROOM, {}); // delta absent

    const merged = snapshotsOf(server).get(ROOM) as InMemorySnapshot;
    expect(merged.content.elements.map(e => e.id)).toContain('db');
    expect(mockWsHandles.emit).toHaveBeenCalledTimes(1);
  });

  it('ignores a non-room id without touching the socket layer', async () => {
    const server = makeServer();

    await server.applyExternalContentUpdate('too-short', {
      elements: [el('b', 1)],
    });

    expect(mockWsHandles.emit).not.toHaveBeenCalled();
    expect(mockWsHandles.fetchSockets).not.toHaveBeenCalled();
  });
});
