import { arrayToMap } from './array.to.map';
import { ExcalidrawElement } from '../../excalidraw/types';
import { orderByFractionalIndex } from './fractionalIndex';

const shouldDiscardRemoteElement = (
  local: ExcalidrawElement | undefined,
  remote: ExcalidrawElement,
): boolean => {
  return !!(
    local &&
    // local element is newer
    (local.version > remote.version ||
      // resolve conflicting edits deterministically by taking the one with
      // the lowest versionNonce
      (local.version === remote.version &&
        local.versionNonce < remote.versionNonce))
  );
};

export const reconcileElements = (
  localElements: readonly ExcalidrawElement[],
  remoteElements: readonly ExcalidrawElement[],
): ExcalidrawElement[] => {
  const localElementsMap = arrayToMap(localElements);
  const reconciledElements: ExcalidrawElement[] = [];
  const added = new Set<string>();

  // process remote elements
  for (const remoteElement of remoteElements) {
    if (!added.has(remoteElement.id)) {
      const localElement = localElementsMap.get(remoteElement.id);
      const discardRemoteElement = shouldDiscardRemoteElement(
        localElement,
        remoteElement,
      );

      if (localElement && discardRemoteElement) {
        reconciledElements.push(localElement);
        added.add(localElement.id);
      } else {
        reconciledElements.push(remoteElement);
        added.add(remoteElement.id);
      }
    }
  }

  // process remaining local elements
  for (const localElement of localElements) {
    if (!added.has(localElement.id)) {
      reconciledElements.push(localElement);
      added.add(localElement.id);
    }
  }

  // de-duplicate indices - leave this to the clients
  // syncInvalidIndices(orderedElements);
  return orderByFractionalIndex(reconciledElements);
};
