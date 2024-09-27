import { arrayToMap } from './array.to.map';
import { ExcalidrawElement } from '../../excalidraw/types';
import { arrayToMapBy } from './array.to.map.by';
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
  return orderByPrecedingElement(reconciledElements);
};

const orderByPrecedingElement = (
  unOrderedElements: ExcalidrawElement[],
): ExcalidrawElement[] | never => {
  // validated there is just one starting element
  const startElements = unOrderedElements.filter(
    (el) => el.__precedingElement__ === '^',
  );

  if (startElements.length !== 1) {
    throw new Error(
      `There must be exactly one element with __precedingElement__ = '^'`,
    );
  }
  // create a map of elements by <__precedingElement__, element that has this __precedingElement__ value>
  const elementMapByPrecedingKey = arrayToMapBy(
    unOrderedElements,
    '__precedingElement__',
  );
  const orderedElements: ExcalidrawElement[] = [];
  // the array is starting with element that has no preceding element
  let parentElement = startElements[0];
  orderedElements.push(parentElement);
  // Follow the chain of __precedingElement__
  while (true) {
    const childElement = elementMapByPrecedingKey.get(parentElement.id);

    if (!childElement) {
      // we have reached the end of the chain
      break;
    }

    orderedElements.push(childElement);
    parentElement = childElement;
  }

  return orderedElements;
};
