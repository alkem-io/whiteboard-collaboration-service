import { ExcalidrawElement } from '../types';
import { arrayToMap } from './array.to.map';
// import { orderByFractionalIndex, syncInvalidIndices } from './fractionalIndex';

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

/*const validateIndicesThrottled = throttle(
  (
    orderedElements: readonly OrderedExcalidrawElement[],
    localElements: readonly OrderedExcalidrawElement[],
    remoteElements: readonly RemoteExcalidrawElement[],
  ) => {
    if (
      import.meta.env.DEV ||
      import.meta.env.MODE === ENV.TEST ||
      window?.DEBUG_FRACTIONAL_INDICES
    ) {
      // create new instances due to the mutation
      const elements = syncInvalidIndices(
        orderedElements.map((x) => ({ ...x })),
      );

      validateFractionalIndices(elements, {
        // throw in dev & test only, to remain functional on `DEBUG_FRACTIONAL_INDICES`
        shouldThrow: import.meta.env.DEV || import.meta.env.MODE === ENV.TEST,
        includeBoundTextValidation: true,
        reconciliationContext: {
          localElements,
          remoteElements,
        },
      });
    }
  },
  1000 * 60,
  { leading: true, trailing: false },
);*/

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

  const orderedElements = orderByFractionalIndex(reconciledElements);

  /**
   * todo: not sure how important is this and how does it affect the end result
   * since the debounce is set to 60 seconds, which might mean that the room has already closed
   * and that the whiteboard is already saved
   */
  // validateIndicesThrottled(orderedElements, localElements, remoteElements);

  // de-duplicate indices
  // const syncedElemented = syncInvalidIndices(orderedElements);

  // return orderedElements as ReconciledExcalidrawElement[];
  // return reconciledElements;
  return orderedElements;
};

/**
 * Order the elements based on the fractional indices.
 * - when fractional indices are identical, break the tie based on the element id
 * - when there is no fractional index in one of the elements, respect the order of the array
 */
export const orderByFractionalIndex = (elements: ExcalidrawElement[]) => {
  return elements.sort((a, b) => {
    // in case the indices are not the defined at runtime
    if (a.index && b.index) {
      if (a.index < b.index) {
        return -1;
      } else if (a.index > b.index) {
        return 1;
      }

      // break ties based on the element id
      return a.id < b.id ? -1 : 1;
    }

    // defensively keep the array order
    return 1;
  });
};
