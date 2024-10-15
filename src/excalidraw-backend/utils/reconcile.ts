import { arrayToMap } from './array.to.map';
import { ExcalidrawElement } from '../../excalidraw/types';
import { orderByFractionalIndex } from './fractionalIndex';

/**
 * Decides by comparison if the remote or local version of the same element must be preferred.
 * If there is no local version of the element - prefer the remote.
 * If the version of the remote element is higher - prefer the remote
 * if both versions are the same - prefer the element with the lowest __versionNonce__ (at random)
 *
 * @param local
 * @param remote
 */
const shouldDiscardRemoteElement = (
  local: ExcalidrawElement | undefined,
  remote: ExcalidrawElement,
): boolean => {
  // there is no local element; use remote
  if (!local) {
    return false;
  }
  // local element is newer; use local
  if (local.version > remote.version) {
    return true;
  }
  // if version are equal
  // resolve conflicts deterministically by taking the one with
  // the lowest versionNonce
  return (
    local.version === remote.version && local.versionNonce < remote.versionNonce
  );
};

export const reconcileElements = (
  localElements: readonly ExcalidrawElement[],
  remoteElements: readonly ExcalidrawElement[],
): ExcalidrawElement[] => {
  const localElementsMap = arrayToMap(localElements);
  const reconciledElements: ExcalidrawElement[] = [];
  // keep track of elements that have been reconciled
  const reconciled = new Set<string>();

  // process remote elements
  for (const remoteElement of remoteElements) {
    // skip if already reconciled
    if (reconciled.has(remoteElement.id)) {
      continue;
    }

    const localElement = localElementsMap.get(remoteElement.id);
    // should discard remote in favor of local
    const discardRemoteElement = shouldDiscardRemoteElement(
      localElement,
      remoteElement,
    );

    if (localElement && discardRemoteElement) {
      reconciledElements.push(localElement);
      reconciled.add(localElement.id);
    } else {
      reconciledElements.push(remoteElement);
      reconciled.add(remoteElement.id);
    }
  }

  // process remaining local elements
  for (const localElement of localElements) {
    // skip if already reconciled
    if (reconciled.has(localElement.id)) {
      continue;
    }

    reconciledElements.push(localElement);
    // add for completeness
    reconciled.add(localElement.id);
  }

  // de-duplicate indices - leave this to the clients
  // syncInvalidIndices(orderedElements);
  return orderByFractionalIndex(reconciledElements);
};
