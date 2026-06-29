import { ExcalidrawElement } from '../../excalidraw/types';

/**
 * A fresh random `versionNonce`, matching Excalidraw's own nonce range (a 31-bit
 * non-negative integer). `reconcileElements` uses `versionNonce` only as the
 * deterministic tie-breaker when two same-id elements share a `version`.
 */
const randomVersionNonce = (): number => Math.floor(Math.random() * 2 ** 31);

/**
 * Re-stamps externally-authored elements so they deterministically WIN per-element
 * reconciliation against the current live snapshot.
 *
 * `reconcileElements` keeps, per id, the element with the higher `version`. An
 * external writer (e.g. the MCP `update_whiteboard_content` tool) is not part of
 * the live version-incrementing loop, so its elements can carry versions equal to
 * or lower than the live ones and silently lose. Bumping each to
 * `max(liveVersion, incomingVersion) + 1` (with a fresh nonce) makes the write
 * authoritative.
 *
 * This is only correct on a DELTA — the elements the writer actually changed,
 * added, or tombstoned. Applied to those (and only those), it leaves every
 * untouched live element exactly as-is; the sole conflict it resolves is a human
 * editing the same element in the same sub-second window, which becomes
 * last-writer-wins in the writer's favour (the user asked for the change).
 * NEVER call this on a full scene — that would clobber concurrent edits to
 * elements the writer never touched.
 *
 * @param elements The changed/added elements (and delete tombstones) to apply.
 * @param liveById The current live elements keyed by id (the merge base).
 */
export const stampElementsToWin = (
  elements: readonly ExcalidrawElement[],
  liveById: Map<string, ExcalidrawElement>,
): ExcalidrawElement[] =>
  elements.map(element => {
    const liveVersion = liveById.get(element.id)?.version ?? 0;
    return {
      ...element,
      version: Math.max(liveVersion, element.version) + 1,
      versionNonce: randomVersionNonce(),
      updated: Date.now(),
    };
  });
