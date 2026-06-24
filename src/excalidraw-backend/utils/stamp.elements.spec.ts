import { ExcalidrawElement } from '../../excalidraw/types';
import { arrayToMap } from './array.to.map';
import { reconcileElements } from './reconcile';
import { stampElementsToWin } from './stamp.elements';

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

describe('stampElementsToWin', () => {
  it('bumps each delta element above its live version with a fresh nonce', () => {
    // Pin the nonce source so the freshness assertion is deterministic (the input
    // elements carry versionNonce: 1; a fresh nonce must replace it).
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const live = arrayToMap([el('a', 5), el('b', 2)]);

      const [a, b] = stampElementsToWin([el('a', 3), el('b', 2)], live);

      // 'a' is live v5 but the incoming delta carried v3 — still must win → v6.
      expect(a.version).toBe(6);
      expect(b.version).toBe(3);
      // fresh nonce derived from the (mocked) random source, not the input's 1
      expect(a.versionNonce).toBe(Math.floor(0.5 * 2 ** 31));
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('treats an element absent from the live base as version 0', () => {
    const [created] = stampElementsToWin([el('new', 1)], arrayToMap([]));
    expect(created.version).toBe(2); // max(0, 1) + 1
  });

  it('does not mutate the incoming elements', () => {
    const incoming = el('a', 1);
    stampElementsToWin([incoming], arrayToMap([el('a', 9)]));
    expect(incoming.version).toBe(1);
  });
});

describe('external-write merge (Option A) — applies the change, preserves live edits', () => {
  it('reconcile keeps an untouched human-edited element and applies the stamped delta', () => {
    // Live scene: 'a' has been edited by a human past the last DB save (v5);
    // 'b' is at v2. The external writer only touched 'b'.
    const localElements = [el('a', 5), el('b', 2)];
    const localById = arrayToMap(localElements);

    const stampedDelta = stampElementsToWin([el('b', 2)], localById);
    const reconciled = reconcileElements(localElements, stampedDelta);

    const byId = arrayToMap(reconciled);
    // The untouched live edit survives (no data loss — hero101's concern).
    expect(byId.get('a')?.version).toBe(5);
    // The external change to 'b' wins deterministically.
    expect(byId.get('b')?.version).toBe(3);
    expect(reconciled).toHaveLength(2);
  });

  it('a delete tombstone in the delta propagates', () => {
    const localElements = [el('a', 5), el('b', 2)];
    const localById = arrayToMap(localElements);

    const tombstone = stampElementsToWin(
      [el('b', 2, { isDeleted: true })],
      localById,
    );
    const reconciled = reconcileElements(localElements, tombstone);

    expect(arrayToMap(reconciled).get('b')?.isDeleted).toBe(true);
  });
});
